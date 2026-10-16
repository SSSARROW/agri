"""
Record a farmer view of an ad detail page.
Deduplicates to one view per farmer per ad per day via the UNIQUE(ad_id, farmer_id, view_date)
constraint — insert is silent when the row already exists.

The router wraps every call in try/except so a DB failure here never breaks the detail response.
"""
from datetime import date
from db.supabase import supabase


def record_view(ad_id: str, farmer_id: str) -> None:
    """
    Inserts (ad_id, farmer_id, today) into ad_views.
    The UNIQUE constraint means duplicate inserts on the same day are ignored
    (Supabase returns an empty data list, which is fine).
    """
    today = date.today().isoformat()
    supabase.table("ad_views").insert(
        {"ad_id": ad_id, "farmer_id": farmer_id, "view_date": today},
        returning="minimal",
    ).execute()
