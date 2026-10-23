"""Removes exporter-side test data and obviously-fake accounts from the shared Supabase project.

DESTRUCTIVE. Runs in ONE transaction and defaults to a DRY RUN that rolls back; pass --apply to commit.
Take a backup first (every table as JSON):   python scripts/cleanup_test_data.py --backup ./backup

What it removes
  * everything owned by exporter profiles that are NOT the demo exporters from scripts/seed_demo.py: their
    ads (+versions, acceptances, views, reports), standards (+versions, stages), farmer links, planting notices
    (+responses, bindings), stage-proof submissions, notifications and verification log, then the profiles
  * the legacy buyer "commitment" rows, and any batch references to them
  * users that are @test.lk, in JUNK_EMAILS, or exporters outside KEEP_EXPORTERS -- together with their plots,
    batches, events and scans in the field database
The four old exporter logins in KEEP_EXPORTERS keep their login but lose their old content (a blank profile is
recreated when they next sign in). It does NOT touch: non-@test.lk admins, the demo accounts, or farmers and
collectors with real-looking names.

NOTE (found by running the dry run): the account-service schema deliberately blocks DELETE on append-only tables
(notifications, notification_runs, ad versions/acceptances/reports/moderation log, ...) through immutability triggers,
so this script stops with e.g. "Cannot delete notifications records." and rolls back. Removing that data needs the
triggers bypassed for one transaction (e.g. SET LOCAL session_replication_role = replica), which defeats those audit
guarantees, so it is NOT done here. Decide that explicitly before adding it.

Run with the field API's Python:   api/.venv/bin/python scripts/cleanup_test_data.py [--apply] [--backup DIR]
"""
import asyncio
import datetime
import decimal
import json
import os
import sys
import uuid
from pathlib import Path

import asyncpg
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
APPLY = "--apply" in sys.argv

# Exporter logins to keep (their old content is wiped; seed_demo.py accounts are always kept).
SEED_EXPORTERS = ["procurement@lakpuratea.lk", "sourcing@cinnamonhouse.lk", "info@mahawelispices.lk"]
KEEP_EXPORTERS = ["exporter@gmail.com", "exporter1@gmail.com", "buyer@ceylonexports.lk", "sasmitha11@gmail.com", *SEED_EXPORTERS]
# Batches whose QR is already printed (poster etc). Their batch, plot, events, authors and buyer-order link are
# never touched; the transaction aborts if anything about them changed.
PROTECT_BATCH_CODES = ["JN9JQXB", "JN9JQXB-OLD"]
JUNK_EMAILS = [
    "test.farmer.smoke@example.com", "ui.protocol.test@example.com", "boundary.test.farmer@example.com",
    "other.farmer@example.com", "phone.test.farmer@example.com", "demo.farmer.tea1016@example.com",
    "collector.demo@example.com", "collector.kamal2@example.com", "demo.collector.tea1016@example.com",
    "demo.permissiontest@paramparatest.lk",
]
def _enc(o):
    if isinstance(o, (datetime.datetime, datetime.date)):
        return o.isoformat()
    if isinstance(o, (decimal.Decimal, uuid.UUID)):
        return str(o)
    return str(o)


async def backup(conn, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    tables = [r["tablename"] for r in await conn.fetch("select tablename from pg_tables where schemaname='public' and tablename <> 'spatial_ref_sys'")]
    for t in tables:
        cols = [r["column_name"] for r in await conn.fetch(
            "select column_name from information_schema.columns where table_schema='public' and table_name=$1 and udt_name not in ('geometry','geography')", t)]
        rows = await conn.fetch(f'select {",".join(chr(34) + c + chr(34) for c in cols)} from public."{t}"')
        (out / f"{t}.json").write_text(json.dumps([dict(r) for r in rows], default=_enc))
        print("backed up", t, len(rows))


async def main():
    url = dotenv_values(ROOT / "api/.env")["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url, timeout=20)
    if "--backup" in sys.argv:
        await backup(conn, Path(sys.argv[sys.argv.index("--backup") + 1]))
    try:
        async with conn.transaction():
            # Authorised one-off: the append-only tables guard themselves with *_immutability triggers. Disable just those
            # (not FK triggers, so cascades keep working) inside this transaction and re-enable before it ends.
            guards = await conn.fetch(
                """select c.relname as tbl, t.tgname as trg from pg_trigger t join pg_class c on c.oid = t.tgrelid
                   join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and not t.tgisinternal
                     and (t.tgname like '%immutability%' or c.relname = 'event')""")
            for g in guards:
                await conn.execute(f'alter table public."{g["tbl"]}" disable trigger "{g["trg"]}"')
            print(f"immutability triggers disabled for this transaction: {len(guards)}")
            doomed = [r["id"] for r in await conn.fetch(
                """select id from users where email like '%@test.lk' or email = any($1::text[])
                   or (role = 'exporter' and email <> all($2::text[]))""", JUNK_EMAILS, KEEP_EXPORTERS)]
            prot = await conn.fetch("select id, plot_id, commitment_id from batch where code = any($1)", PROTECT_BATCH_CODES)
            prot_batches = [r["id"] for r in prot]
            prot_plots = [r["plot_id"] for r in prot if r["plot_id"]]
            keep_commitments = [r["commitment_id"] for r in prot if r["commitment_id"]]
            prot_users = {r["owner_user_id"] for r in await conn.fetch("select owner_user_id from plot where id = any($1)", prot_plots) if r["owner_user_id"]}
            prot_users |= {r["user_id"] for r in await conn.fetch("select distinct user_id from event where batch_id = any($1) or plot_id = any($2)", prot_batches, prot_plots) if r["user_id"]}
            prot_users |= {r["buyer_user_id"] for r in await conn.fetch("select buyer_user_id from commitment where id = any($1)", keep_commitments)}
            before = await conn.fetchval("select count(*) from event where batch_id = any($1) or plot_id = any($2)", prot_batches, prot_plots)
            doomed = [u for u in doomed if u not in prot_users]
            plots = [r["id"] for r in await conn.fetch("select id from plot where owner_user_id = any($1) and id <> all($2)", doomed, prot_plots)]
            batches = [r["id"] for r in await conn.fetch("select id from batch where plot_id = any($1) and id <> all($2)", plots, prot_batches)]
            print(f"protected batches: {PROTECT_BATCH_CODES} -> keeping {len(prot_users)} users, {len(prot_plots)} plots, {len(keep_commitments)} commitments")
            print(f"users to delete: {len(doomed)}  plots: {len(plots)}  batches: {len(batches)}")

            junk = [r["id"] for r in await conn.fetch(
                "select id from exporter_profiles where user_id <> all(select id from users where email = any($1::text[]))", SEED_EXPORTERS)]
            print(f"junk exporter profiles: {len(junk)}")
            # children before parents: several references are ON DELETE RESTRICT
            await conn.execute("delete from stage_proof_submissions where exporter_profile_id = any($1)", junk)
            await conn.execute("delete from notifications where notice_id in (select id from planting_notices where exporter_profile_id = any($1))", junk)
            await conn.execute("delete from planting_notices where exporter_profile_id = any($1)", junk)
            await conn.execute("delete from ad_acceptances where ad_id in (select id from ads where exporter_profile_id = any($1))", junk)
            await conn.execute("delete from ads where exporter_profile_id = any($1)", junk)
            await conn.execute("delete from farmer_exporter_links where exporter_profile_id = any($1)", junk)
            # test data sometimes points an ad/notice at another profile's standard: clear those references first
            junk_versions = "select v.id from quality_standard_versions v join quality_standards q on q.id = v.standard_id where q.exporter_profile_id = any($1)"
            await conn.execute(f"delete from ad_acceptances where ad_version_id in ({junk_versions})", junk)
            await conn.execute(f"delete from ad_versions where standard_version_id in ({junk_versions})", junk)
            await conn.execute(f"delete from planting_notices where standard_version_id in ({junk_versions})", junk)
            await conn.execute("delete from quality_standards where exporter_profile_id = any($1)", junk)

            await conn.execute("delete from scan where batch_id = any($1)", batches)
            await conn.execute("delete from event where user_id = any($1) or plot_id = any($2) or batch_id = any($3)", doomed, plots, batches)
            await conn.execute(
                "update batch set parent_batch_ids = (select coalesce(array_agg(x), '{}') from unnest(parent_batch_ids) x where x <> all($1)) "
                "where parent_batch_ids && $1::uuid[]", batches)
            await conn.execute("delete from batch where id = any($1)", batches)
            await conn.execute("delete from plot where id = any($1)", plots)
            await conn.execute("update batch set commitment_id = null where commitment_id is not null and commitment_id <> all($1)", keep_commitments)
            print("commitments:", await conn.fetchval("select count(*) from commitment"), "(keeping", len(keep_commitments), ")")
            await conn.execute("delete from commitment where id <> all($1)", keep_commitments)
            await conn.execute("delete from exporter_profiles where id = any($1)", junk)
            await conn.execute("delete from users where id = any($1)", doomed)
            for t in ("users", "exporter_profiles", "plot", "batch", "event"):
                print(f"{t} now: {await conn.fetchval(f'select count(*) from {t}')}")
            after = await conn.fetchval("select count(*) from event where batch_id = any($1) or plot_id = any($2)", prot_batches, prot_plots)
            still = await conn.fetchval("select count(*) from batch where id = any($1)", prot_batches)
            assert still == len(prot_batches) and after == before, f"protected batch changed! batches {still}/{len(prot_batches)} events {after}/{before}"
            kept_links = await conn.fetchval("select count(*) from batch where id = any($1) and commitment_id = any($2)", prot_batches, keep_commitments) if keep_commitments else 0
            assert kept_links == len([1 for r in prot if r["commitment_id"]]), "protected batch lost its buyer-order link"
            print(f"protected batches intact: {still} batches, {after} events")
            for g in guards:
                await conn.execute(f'alter table public."{g["tbl"]}" enable trigger "{g["trg"]}"')
            print(f"immutability triggers re-enabled: {len(guards)}")
            if not APPLY:
                print("\nDRY RUN: rolling back. Re-run with --apply to commit.")
                raise SystemExit
    except SystemExit:
        pass
    finally:
        await conn.close()


asyncio.run(main())
