/**
 * Nara System — Email Relay (Google Apps Script)
 * Mengirim email notifikasi Tugas Saya dari akun Gmail pemilik script
 * (mis. natarakonstruksi@gmail.com). Dipanggil oleh Cloudflare Worker.
 *
 * Pasang:
 * 1. Buka https://script.google.com → New project → tempel file ini.
 * 2. Project Settings → Script Properties → tambah:
 *      RELAY_SECRET = (kata sandi acak panjang, sama dengan EMAIL_GAS_SECRET di Cloudflare)
 * 3. Deploy → New deployment → Web app
 *      Execute as: Me   |   Who has access: Anyone
 *    Salin URL Web app → isi EMAIL_GAS_URL di Cloudflare.
 * 4. Jalankan fungsi testKirim() sekali dari editor untuk memberi izin Gmail.
 *
 * Kuota Gmail biasa: ±100 penerima/hari (Google Workspace: ±1.500/hari).
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('RELAY_SECRET');
    if (!secret || body.secret !== secret) return out_({ ok: false, message: 'Secret tidak cocok.' });
    if (!body.to || !body.subject) return out_({ ok: false, message: 'Field to/subject wajib.' });
    var quota = MailApp.getRemainingDailyQuota();
    if (quota < 1) return out_({ ok: false, message: 'Kuota email harian Gmail habis. Akan dicoba ulang otomatis.' });
    MailApp.sendEmail({
      to: String(body.to),
      subject: String(body.subject).slice(0, 250),
      htmlBody: String(body.html || ''),
      body: String(body.text || ''),
      name: String(body.fromName || 'Nara System — Natara Konstruksi')
    });
    return out_({ ok: true, id: 'gas-' + new Date().getTime(), quotaLeft: quota - 1 });
  } catch (err) {
    return out_({ ok: false, message: String(err && err.message || err) });
  }
}

function doGet() {
  return out_({ ok: true, service: 'Nara System Email Relay', quotaLeft: MailApp.getRemainingDailyQuota() });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Jalankan sekali dari editor untuk memberi izin & mengecek pengiriman. */
function testKirim() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), '[Nara System] Tes relay email', 'Relay email Nara System berfungsi.');
}
