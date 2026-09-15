export default function Scan() {
  return (
    <section className="screen">
      <h1>Scan</h1>
      <p className="muted">
        QR scanning (M-02) lands here — native <code>BarcodeDetector</code> where available,
        falling back to <code>html5-qrcode</code>.
      </p>
      <div className="scan-placeholder">Camera view placeholder</div>
    </section>
  )
}
