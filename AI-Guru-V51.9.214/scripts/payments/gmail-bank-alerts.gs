/**
 * AI Guru — UPI payments confirmed automatically from your bank's e-mail alerts (V51.9.190; batches since V51.9.195).
 *
 * Runs in YOUR Gmail (script.google.com), every 5 minutes. It finds new HDFC Bank "credited" alerts, sends them to
 * AI Guru with your secret, and labels them "ai-guru-sent" so each is sent once. AI Guru confirms a fee payment only
 * when the bank's credit has the same 12-digit UPI reference AND the same amount that the family typed in; anything
 * else waits for you on the Fees page. Nothing in your mailbox is changed except that label.
 *
 * Setup (once):
 *   1. HDFC NetBanking / app → InstaAlerts: turn on e-mail alerts for UPI credits to this Gmail address.
 *   2. Run scripts/cloud/setup-bank-alerts.sh in Cloud Shell; it prints AI_GURU_URL and AI_GURU_SECRET.
 *   3. script.google.com → New project → paste this file → Project Settings → Script properties → add both.
 *   4. Select the function "install" → Run → allow access. Done.
 * To test: Run "sendBankAlerts" and look at Executions; AI Guru's Fees page shows "Bank alerts are set up · last alert …".
 */
var SENDERS = 'from:(alerts@hdfcbank.net OR alerts@hdfcbank.bank.in OR alerts@hdfcbank.com)';
var QUERY = SENDERS + ' newer_than:3d -label:ai-guru-sent (credited OR received OR deposited)';
var LABEL = 'ai-guru-sent';

function sendBankAlerts() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('AI_GURU_URL'), secret = props.getProperty('AI_GURU_SECRET');
  if (!url || !secret) throw new Error('Add AI_GURU_URL and AI_GURU_SECRET in Project Settings → Script properties');
  var label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  var threads = GmailApp.search(QUERY, 0, 40);
  if (!threads.length) return;
  // V51.9.195: sent in batches of up to 50 alerts; a thread is labelled only after the batch holding it was received,
  // so nothing is skipped when there are more than 50, and a failed batch is simply sent again next time.
  var batch = [], batchThreads = [];
  function flush() {
    if (!batch.length) return true;
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-alert-secret': secret },
      payload: JSON.stringify({ alerts: batch }),
    });
    console.log(res.getResponseCode() + ' ' + res.getContentText().slice(0, 500));
    if (res.getResponseCode() !== 200) return false;
    batchThreads.forEach(function (t) { t.addLabel(label); });
    batch = []; batchThreads = [];
    return true;
  }
  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages().filter(fromTheBank).map(function (m) { return { subject: m.getSubject(), text: m.getPlainBody().slice(0, 4000), source: 'email' }; });
    if (batch.length && batch.length + msgs.length > 50 && !flush()) return; // stop; the rest go next time
    batch = batch.concat(msgs.slice(0, 50)); batchThreads.push(threads[i]);
  }
  flush();
}

/**
 * V51.9.196 (security check): only an e-mail that Gmail checked as really sent by the bank (DKIM signed by the bank's
 * domain, or DMARC passed). A forged "from HDFC" e-mail is never sent to AI Guru.
 */
function fromTheBank(m) {
  var auth = String(m.getHeader('Authentication-Results') || '').toLowerCase();
  var from = String(m.getFrom() || '').toLowerCase();
  var domain = (from.match(/@([a-z0-9.-]+)/) || [])[1] || '';
  if (!/hdfcbank\.(net|com|bank\.in)$/.test(domain)) return false;
  return /dmarc=pass/.test(auth) || new RegExp('dkim=pass[^;]*header\\.(i|d)=@?[a-z0-9.-]*hdfcbank').test(auth);
}

function install() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === 'sendBankAlerts') ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger('sendBankAlerts').timeBased().everyMinutes(5).create();
  sendBankAlerts();
}
