// ════════════════════════════════════════════════════════════════════════
// ALFRISCO INVENTORY SYSTEM — Complete Google Apps Script
// Last updated: includes updateStaff, canBackorderDist, canBackorderRetail
// HOW TO DEPLOY:
//   1. Open Google Sheet → Extensions → Apps Script
//   2. Select ALL existing code → Delete
//   3. Paste this entire file
//   4. Save (Ctrl+S)
//   5. Deploy → Manage Deployments → pencil icon → New version → Deploy
// ════════════════════════════════════════════════════════════════════════

// ── SECURITY TOKEN — must match API_SECRET in config.js ──────────────────
const API_TOKEN = 'ALF-1b9KshUR1pds6qKb7jwaYEKF';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Reject requests that don't carry the correct token
    if (!data._token || data._token !== API_TOKEN) {
      return ContentService
        .createTextOutput(JSON.stringify({status:'error', msg:'Unauthorized'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── GET STAFF ──────────────────────────────────────────────────────
    if (data.action === 'getStaff') {
      let sheet = ss.getSheetByName('Staff');
      if (!sheet) {
        sheet = ss.insertSheet('Staff');
        sheet.appendRow(['Username','Password','Role','AssignedUnit',
                         'CanCountDist','CanCountRetail',
                         'CanManagePODist','CanManagePORetail',
                         'CanBackorderDist','CanBackorderRetail',
                         'CanProduction','CanTransfer','CanViewProductList','CanStockAdjust','PLView',
                         'CanManageDealers','CanCreateInvoice']);
        sheet.appendRow(['Adrian','admin2026','admin','All',
                         'YES','YES','YES','YES','YES','YES','YES','YES','YES','YES','both','YES','YES']);
      }
      const rows = sheet.getDataRange().getValues();
      const staff = rows.slice(1).filter(r => r[0]).map(r => ({
        username:          String(r[0]).trim(),
        password:          String(r[1]).trim(),
        role:              String(r[2]).trim(),
        assignedUnit:      String(r[3] || 'All').trim(),
        canCountDist:      String(r[4] || 'YES').toUpperCase() !== 'NO',
        canCountRetail:    String(r[5] || 'YES').toUpperCase() !== 'NO',
        canManagePODist:   String(r[6] || 'NO').toUpperCase()  === 'YES',
        canManagePORetail: String(r[7] || 'NO').toUpperCase()  === 'YES',
        canBackorderDist:  String(r[8] || 'YES').toUpperCase() !== 'NO',
        canBackorderRetail:String(r[9] || 'NO').toUpperCase()  === 'YES',
        canProduction:     String(r[10]|| 'NO').toUpperCase()  === 'YES',
        canTransfer:       String(r[11]|| 'NO').toUpperCase()  === 'YES',
        canViewProductList:String(r[12]|| 'YES').toUpperCase() !== 'NO',
        canStockAdjust:    String(r[13]|| 'NO').toUpperCase()  === 'YES',
        plView:            String(r[14]|| 'both').toLowerCase() || 'both',
        canManageDealers:  String(r[15]|| 'NO').toUpperCase()  === 'YES',
        canCreateInvoice:  String(r[16]|| 'NO').toUpperCase()  === 'YES',
        canViewCountHistory: String(r[17]|| 'NO').toUpperCase() === 'YES',
        canApprovePODist:    String(r[18]|| 'NO').toUpperCase() === 'YES',
        canApprovePORetail:  String(r[19]|| 'NO').toUpperCase() === 'YES',
        dailyRate:           Number(r[20]) || 0,  // U: basis for HR pay estimates
        payType:             String(r[21]||'daily').toLowerCase()==='hourly' ? 'hourly' : 'daily', // V
        schedule:            String(r[22]||'').trim(),  // W: Work Schedule name
        allowance:           Number(r[23]) || 0         // X: daily allowance
      }));
      return ok({ staff });
    }

    // ── ADD STAFF ──────────────────────────────────────────────────────
    if (data.action === 'addStaff') {
      let sheet = ss.getSheetByName('Staff');
      if (!sheet) {
        sheet = ss.insertSheet('Staff');
        sheet.appendRow(['Username','Password','Role','AssignedUnit',
                         'CanCountDist','CanCountRetail',
                         'CanManagePODist','CanManagePORetail',
                         'CanBackorderDist','CanBackorderRetail',
                         'CanProduction','CanTransfer','CanViewProductList','CanStockAdjust','PLView',
                         'CanManageDealers','CanCreateInvoice']);
      }
      sheet.appendRow([
        data.username,                                              // A: Username
        data.password,                                              // B: Password
        data.role,                                                  // C: Role
        data.assignedUnit || 'All',                                 // D: AssignedUnit
        data.canCountDist      !== false ? 'YES' : 'NO',           // E: CanCountDist
        data.canCountRetail    !== false ? 'YES' : 'NO',           // F: CanCountRetail
        data.canManagePODist    ? 'YES' : 'NO',                    // G: CanManagePODist
        data.canManagePORetail  ? 'YES' : 'NO',                    // H: CanManagePORetail
        data.canBackorderDist  !== false ? 'YES' : 'NO',           // I: CanBackorderDist
        data.canBackorderRetail ? 'YES' : 'NO',                    // J: CanBackorderRetail
        data.canProduction      ? 'YES' : 'NO',                    // K: CanProduction
        data.canTransfer        ? 'YES' : 'NO',                    // L: CanTransfer
        data.canViewProductList !== false ? 'YES' : 'NO',          // M: CanViewProductList
        data.canStockAdjust     ? 'YES' : 'NO',                    // N: CanStockAdjust
        data.plView || 'both',                                      // O: PLView
        data.canManageDealers   ? 'YES' : 'NO',                    // P: CanManageDealers
        data.canCreateInvoice   ? 'YES' : 'NO',                    // Q: CanCreateInvoice
        data.canViewCountHistory ? 'YES' : 'NO',                   // R: CanViewCountHistory
        data.canApprovePODist   ? 'YES' : 'NO',                    // S: CanApprovePODist
        data.canApprovePORetail ? 'YES' : 'NO',                    // T: CanApprovePORetail
        Number(data.dailyRate) || 0,                               // U: Daily Rate (HR)
        String(data.payType||'daily').toLowerCase()==='hourly' ? 'hourly' : 'daily'  // V: Pay Type
      ]);
      if (sheet.getRange(1, 18).getValue() === '') sheet.getRange(1, 18).setValue('CanViewCountHistory');
      if (sheet.getRange(1, 19).getValue() === '') sheet.getRange(1, 19).setValue('CanApprovePODist');
      if (sheet.getRange(1, 20).getValue() === '') sheet.getRange(1, 20).setValue('CanApprovePORetail');
      if (sheet.getRange(1, 21).getValue() === '') sheet.getRange(1, 21).setValue('Daily Rate');
      if (sheet.getRange(1, 22).getValue() === '') sheet.getRange(1, 22).setValue('Pay Type');
      return ok({});
    }

    // ── UPDATE STAFF PERMISSIONS ───────────────────────────────────
    if (data.action === 'updateStaff') {
      const sheet = ss.getSheetByName('Staff');
      if (!sheet) return err('Staff sheet not found');
      const rows = sheet.getDataRange().getValues();
      let updated = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).toLowerCase() === String(data.username).toLowerCase()) {
          sheet.getRange(i+1, 3).setValue(data.role);
          sheet.getRange(i+1, 4).setValue(data.assignedUnit || 'All');
          sheet.getRange(i+1, 5).setValue(data.canCountDist       !== false ? 'YES' : 'NO');
          sheet.getRange(i+1, 6).setValue(data.canCountRetail     !== false ? 'YES' : 'NO');
          sheet.getRange(i+1, 7).setValue(data.canManagePODist    ? 'YES' : 'NO');
          sheet.getRange(i+1, 8).setValue(data.canManagePORetail  ? 'YES' : 'NO');
          sheet.getRange(i+1, 9).setValue(data.canBackorderDist   !== false ? 'YES' : 'NO');
          sheet.getRange(i+1, 10).setValue(data.canBackorderRetail ? 'YES' : 'NO');
          sheet.getRange(i+1, 11).setValue(data.canProduction     ? 'YES' : 'NO');
          sheet.getRange(i+1, 12).setValue(data.canTransfer       ? 'YES' : 'NO');
          sheet.getRange(i+1, 13).setValue(data.canViewProductList !== false ? 'YES' : 'NO');
          sheet.getRange(i+1, 14).setValue(data.canStockAdjust     ? 'YES' : 'NO');
          sheet.getRange(i+1, 15).setValue(data.plView || 'both');
          sheet.getRange(i+1, 16).setValue(data.canManageDealers   ? 'YES' : 'NO');
          sheet.getRange(i+1, 17).setValue(data.canCreateInvoice   ? 'YES' : 'NO');
          sheet.getRange(i+1, 18).setValue(data.canViewCountHistory ? 'YES' : 'NO');
          sheet.getRange(i+1, 19).setValue(data.canApprovePODist   ? 'YES' : 'NO');
          sheet.getRange(i+1, 20).setValue(data.canApprovePORetail ? 'YES' : 'NO');
          // Daily rate is optional on the payload — only overwrite when supplied,
          // so a permissions-only save can never wipe someone's pay rate
          if (data.dailyRate !== undefined && data.dailyRate !== null && data.dailyRate !== '')
            sheet.getRange(i+1, 21).setValue(Number(data.dailyRate) || 0);
          if (data.payType !== undefined && data.payType !== null && data.payType !== '')
            sheet.getRange(i+1, 22).setValue(String(data.payType).toLowerCase()==='hourly' ? 'hourly' : 'daily');
          if (data.schedule !== undefined && data.schedule !== null)
            sheet.getRange(i+1, 23).setValue(String(data.schedule).trim());
          if (data.allowance !== undefined && data.allowance !== null && data.allowance !== '')
            sheet.getRange(i+1, 24).setValue(Number(data.allowance) || 0);
          if (sheet.getRange(1, 23).getValue() === '') sheet.getRange(1, 23).setValue('Work Schedule');
          if (sheet.getRange(1, 24).getValue() === '') sheet.getRange(1, 24).setValue('Daily Allowance');
          if (sheet.getRange(1, 18).getValue() === '') sheet.getRange(1, 18).setValue('CanViewCountHistory');
          if (sheet.getRange(1, 19).getValue() === '') sheet.getRange(1, 19).setValue('CanApprovePODist');
          if (sheet.getRange(1, 20).getValue() === '') sheet.getRange(1, 20).setValue('CanApprovePORetail');
          if (sheet.getRange(1, 21).getValue() === '') sheet.getRange(1, 21).setValue('Daily Rate');
          if (sheet.getRange(1, 22).getValue() === '') sheet.getRange(1, 22).setValue('Pay Type');
          updated = true;
          break;
        }
      }
      return ok({ updated });
    }

    // ── REMOVE STAFF ───────────────────────────────────────────────────
    if (data.action === 'removeStaff') {
      const sheet = ss.getSheetByName('Staff');
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        for (let i = rows.length - 1; i >= 1; i--) {
          if (String(rows[i][0]).toLowerCase() === String(data.username).toLowerCase()) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
      }
      return ok({});
    }

    // ── GET DELIVERY VEHICLES ──────────────────────────────────────────
    // Single expandable source of truth for delivery units. To add a vehicle,
    // append a row to the 'Delivery Vehicles' sheet (or set Active = NO to retire
    // one). The dealer dropdown, Load List tabs, and movement unit selector all
    // read from here — no code change needed to add a van.
    if (data.action === 'getVehicles') {
      const vSheet = getOrCreateSheet(ss, 'Delivery Vehicles', ['Vehicle ID','Label','Active','Xero Division']);
      // Seed defaults the first time the sheet is created. The Xero Division maps the
      // van to its Xero TrackingOption2 value so sales auto-route to the right unit.
      if (vSheet.getLastRow() < 2) {
        vSheet.appendRow(['Bajaj1', 'Bajaj 1', 'YES', 'Wholesale-Bajaj1']);
        vSheet.appendRow(['Bajaj2', 'Bajaj 2', 'YES', 'Wholesale-Bajaj2']);
      }
      if (vSheet.getRange(1,4).getValue() === '') vSheet.getRange(1,4).setValue('Xero Division');
      const vehicles = vSheet.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && String(r[2]||'YES').toUpperCase() !== 'NO'; })
        .map(function(r){
          return { id: String(r[0]).trim(), label: String(r[1] || r[0]).trim(), xeroDivision: String(r[3]||'').trim() };
        });
      return ok({ vehicles: vehicles });
    }

    // ── ATTENDANCE: CLOCK IN / OUT ─────────────────────────────────────
    // Server-side timestamp (Manila) so lateness penalties can't be gamed by
    // changing the phone clock. Photo saved to Drive; GPS recorded if provided.
    // Staff rule (Employee Time Monitoring basis): hard cutoff 07:46:00 counting
    // SECONDS (no grace), and clocking in at/after 12:00:00 = HALF DAY. Cutoffs
    // live in 'Attendance Settings' (editable). Applies to role 'staff' only.
    if (data.action === 'clockAttendance') {
      const aSheet = getOrCreateSheet(ss, 'Attendance', [
        'Timestamp','Username','Action','Late','Photo','Latitude','Longitude','Accuracy (m)','Role'
      ]);
      // Backfill the Role header on sheets created before that column existed
      if (aSheet.getRange(1, 9).getValue() === '') aSheet.getRange(1, 9).setValue('Role');
      // Same Operating Hours the payroll engine uses — one source of truth, and
      // hrHmsToSec() copes with Sheets storing "07:45:00" as a real time value.
      // Lateness is judged against THIS employee's schedule (retail vs warehouse
      // start differently), falling back to the global Operating Hours.
      const opCfg = hrScheduleFor(ss, hrStaffPay(ss)[String(data.username||'').trim().toLowerCase()],
                                  hrSettings(ss), hrCutoffRange(0).startDate);
      var officialStart = hrSecToHms(opCfg.officialStart),
          staffCutoff   = hrSecToHms(opCfg.staffCutoff),
          halfDayAfter  = hrSecToHms(opCfg.halfDayAfter);
      function _hmsToSec(s, def){ return hrHmsToSec(s, def); }

      // Hard-coded Manila time: attendance drives payroll penalties, so it must
      // never depend on the Apps Script project's timezone setting being correct
      const tz   = 'Asia/Manila';
      const nowD = new Date();
      const now  = Utilities.formatDate(nowD, tz, 'yyyy-MM-dd HH:mm:ss');
      const act  = String(data.clockAction||'').toUpperCase() === 'OUT' ? 'OUT' : 'IN';

      // Idempotency guard — a double-tap or a network retry that lands twice is
      // ONE punch, not two. Same user + same action within 2 minutes → return the
      // existing punch (also avoids saving a duplicate photo to Drive).
      // Only the TAIL of the sheet can matter for a 2-minute window, so read the
      // last 20 rows instead of the whole ever-growing Attendance sheet.
      const aLast = aSheet.getLastRow();
      if (aLast > 1) {
        const tailStart = Math.max(2, aLast - 19);
        const dupRows = aSheet.getRange(tailStart, 1, aLast - tailStart + 1, 4).getValues();
        for (var di = dupRows.length - 1; di >= 0; di--) {
          if (String(dupRows[di][1]).toLowerCase() !== String(data.username||'').toLowerCase()) continue;
          if (String(dupRows[di][2]).toUpperCase() === act) {
            var prevD = dupRows[di][0] instanceof Date ? dupRows[di][0] : new Date(String(dupRows[di][0]));
            if (!isNaN(prevD.getTime()) && (nowD.getTime() - prevD.getTime()) < 2*60*1000) {
              return ok({
                timestamp: Utilities.formatDate(prevD, tz, 'yyyy-MM-dd HH:mm:ss'),
                clockAction: act,
                late: String(dupRows[di][3]||''),
                duplicate: true
              });
            }
          }
          break; // only the user's most recent punch matters
        }
      }

      // Late / half-day flag — staff roles only (staff + staff-retail; drivers and
      // admin are not flagged), on IN, second-accurate. HARD cutoff: hitting
      // 07:46:00 exactly is already LATE. Minutes late are measured from the
      // official 07:45:00 start so they match the Time Monitoring deduction basis.
      // Hourly staff are never flagged late: they're paid only for hours actually
      // clocked, so arriving late already costs them — a LATE flag would label the
      // same lost time twice.
      const payerRec = hrStaffPay(ss)[String(data.username||'').trim().toLowerCase()];
      const isHourly = payerRec && payerRec.payType === 'hourly';
      var late = '';
      if (act === 'IN' && !isHourly && String(data.role||'').toLowerCase().indexOf('staff') === 0) {
        var inSec = Number(Utilities.formatDate(nowD, tz, 'H'))*3600
                  + Number(Utilities.formatDate(nowD, tz, 'm'))*60
                  + Number(Utilities.formatDate(nowD, tz, 's'));
        var hdSec    = _hmsToSec(halfDayAfter, 12*3600);
        var cutSec   = _hmsToSec(staffCutoff, 7*3600 + 46*60);
        var startSec = _hmsToSec(officialStart, 7*3600 + 45*60);
        if (inSec >= hdSec) {
          late = 'HALF DAY';
        } else if (inSec >= cutSec) {
          var over = Math.max(0, inSec - startSec);
          var mm = Math.floor(over/60), sspart = over % 60;
          late = 'LATE +' + mm + 'm' + (sspart ? ' ' + sspart + 's' : '');
        }
      }

      // Photo → Drive folder (link stored in the sheet, like the Google Form did)
      var photoUrl = '';
      if (data.photo) {
        try {
          var pm   = String(data.photo).match(/^data:(image\/\w+);base64,(.+)$/);
          var b64  = pm ? pm[2] : String(data.photo);
          var mime = pm ? pm[1] : 'image/jpeg';
          var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime,
            'ATT_' + (data.username||'user') + '_' + Utilities.formatDate(nowD, tz, 'yyyyMMdd_HHmmss') + '_' + act + '.jpg');
          var fIt    = DriveApp.getFoldersByName('AE-ON Attendance Photos');
          var folder = fIt.hasNext() ? fIt.next() : DriveApp.createFolder('AE-ON Attendance Photos');
          photoUrl   = folder.createFile(blob).getUrl();
        } catch(phErr) { photoUrl = '(photo save failed)'; }
      }

      aSheet.appendRow([now, data.username||'', act, late, photoUrl,
        data.lat||'', data.lng||'', data.accuracy||'', data.role||'']);
      return ok({ timestamp: now, clockAction: act, late: late });
    }

    // ── ATTENDANCE: CURRENT STATUS ─────────────────────────────────────
    if (data.action === 'getAttendanceStatus') {
      const atSheet = ss.getSheetByName('Attendance');
      if (!atSheet) return ok({ last: null });
      const uname = String(data.username||'').toLowerCase();
      const atRows = atSheet.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && String(r[1]).toLowerCase() === uname; });
      if (!atRows.length) return ok({ last: null });
      const lastR = atRows[atRows.length - 1];
      const lastTs = lastR[0] instanceof Date
        ? Utilities.formatDate(lastR[0], 'Asia/Manila', 'yyyy-MM-dd HH:mm:ss')
        : String(lastR[0]);
      return ok({ last: { timestamp: lastTs, action: String(lastR[2]), late: String(lastR[3]||'') } });
    }

    // ── ATTENDANCE: MY HISTORY (employee's own record) ─────────────────
    // Groups the employee's punches by day: first IN → Time In (+ late flag),
    // last OUT → Time Out. Returns the most recent 30 days PLUS the latest punch
    // (`last`), so the clock screen needs one round trip instead of two.
    if (data.action === 'getMyAttendance') {
      const atSheet = ss.getSheetByName('Attendance');
      if (!atSheet) return ok({ days: [], last: null });
      const tz    = 'Asia/Manila';  // attendance is payroll-critical — never trust the project tz
      const uname = String(data.username||'').toLowerCase();
      const rows  = atSheet.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && String(r[1]).toLowerCase() === uname; });
      const byDay = {};
      rows.forEach(function(r){
        var ts = r[0] instanceof Date
          ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd HH:mm:ss')
          : String(r[0]);
        var date = ts.slice(0,10), time = ts.slice(11,19);
        var act  = String(r[2]).toUpperCase();
        if (!byDay[date]) byDay[date] = { date: date, timeIn:'', timeOut:'', late:'' };
        if (act === 'IN') {
          if (!byDay[date].timeIn) { byDay[date].timeIn = time; byDay[date].late = String(r[3]||''); }
        } else if (act === 'OUT') {
          byDay[date].timeOut = time; // last OUT of the day wins
        }
      });
      const days = Object.keys(byDay).sort().reverse().slice(0, 30).map(function(k){ return byDay[k]; });
      // Latest punch (rows are in sheet/append order) — powers the status card
      var lastPunch = null;
      if (rows.length) {
        var lr = rows[rows.length - 1];
        var lts = lr[0] instanceof Date
          ? Utilities.formatDate(lr[0], tz, 'yyyy-MM-dd HH:mm:ss')
          : String(lr[0]);
        lastPunch = { timestamp: lts, action: String(lr[2]), late: String(lr[3]||'') };
      }
      // Hourly staff get Pause/Resume on the clock; the selfie is only required
      // on the day's FIRST punch so pausing repeatedly isn't a chore.
      const meRec = hrStaffPay(ss)[uname];
      const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
      let punchesToday = 0;
      rows.forEach(function(r){
        const t = r[0] instanceof Date
          ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]).slice(0,10);
        if (t === todayStr) punchesToday++;
      });
      return ok({ days: days, last: lastPunch,
                  payType: meRec ? meRec.payType : 'daily',
                  punchesToday: punchesToday });
    }

    // ── MY HR: attendance standing + expected salary for a pay cutoff ──
    // Semi-monthly cutoffs: 1–15 and 16–end of month. Pay rules mirror the
    // Employee Time Monitoring workbook:
    //   full day        → daily rate
    //   LATE +Xm        → rate − (rate ÷ 10) × hours late
    //   HALF DAY        → rate ÷ 2
    //   no punch        → not counted (no pay, no deduction)
    // Approved-but-unsettled cash advances are deducted from the total.
    // `offset` 0 = current cutoff, -1 = previous, -2 = the one before, etc.
    if (data.action === 'getMyHR') {
      const range = hrCutoffRange(Number(data.offset)||0);
      const unameL = String(data.username||'').trim().toLowerCase();

      const who = hrStaffPay(ss)[unameL] || { dailyRate:0, payType:'daily', found:false };
      const grouped = hrGroupAttendance(ss, range.startDate, range.endDate);
      // Judge this person against THEIR schedule, not one company-wide window
      const cfg = hrScheduleFor(ss, who, hrSettings(ss), range.startDate);
      const res = hrComputeDays(grouped[unameL] || {}, who.dailyRate, who.payType, cfg,
                                hrPayAdjustments(ss)[unameL]);
      const isCur = (Number(data.offset)||0) === 0;
      const adv = hrAdvanceForCutoff(hrCashAdvances(ss)[unameL], range, isCur);
      const cashAdvance = adv.total;
      // Additions: daily allowance for every day worked, plus approved reimbursements
      const allowance = (who.allowance || 0) * res.daysWorked;
      const rmb = hrReimburseForCutoff(hrReimbursements(ss)[unameL], range, isCur);
      // Manual admin-entered extras, matched to this cutoff by their own date
      const addp = hrAddPayForCutoff(hrAdditionalPay(ss)[unameL], range);
      // Manual deductions (shortage, damage) — also matched by their own date
      const ded = hrDeductForCutoff(hrDeductions(ss)[unameL], range);

      const r2 = function(n){ return Math.round(n*100)/100; };
      // Net can go below zero when deductions exceed what was earned. Pay is
      // floored at zero, but the uncovered balance is reported rather than
      // silently dropped, so nobody thinks the debt was written off.
      const rawNet = res.gross + allowance + rmb.total + addp.total
                   - res.totalDeduction - cashAdvance - ded.total;
      const expected  = Math.max(0, rawNet);
      const shortfall = rawNet < 0 ? -rawNet : 0;

      return ok({
        period:      range.label,
        startDate:   range.startDate,
        endDate:     range.endDate,
        offset:      Number(data.offset)||0,
        rateSet:     who.dailyRate > 0,
        found:       who.found === true,
        payType:     who.payType,
        dailyRate:   who.dailyRate,
        hourlyRate:  r2(who.dailyRate / (cfg.dutyHours || HR_STD_HOURS)),
        stdHours:    cfg.dutyHours || HR_STD_HOURS,
        scheduleName:  cfg.name || 'Operating Hours',
        scheduleStart: hrSecToHms(cfg.officialStart).slice(0,5),
        scheduleEnd:   hrSecToHms(cfg.officialEnd).slice(0,5),
        undertimeDays:      res.undertimeDays,
        undertimeMinutes:   Math.round(res.undertimeMinutes),
        undertimeDeduction: r2(res.undertimeDeduction),
        heldDays:           res.heldDays,
        voidedDays:         res.voidedDays,
        heldDeduction:      r2(res.heldDeduction),
        awaitingResponse:   res.awaitingResponse,
        hoursPaid:   r2(res.hoursPaid),
        otHours:     r2(res.otHours),
        fullDays:    res.fullDays,
        incompleteDays: res.incompleteDays,
        daysWorked:  res.daysWorked,
        lateDays:    res.lateDays,
        halfDays:    res.halfDays,
        lateMinutes: Math.round(res.lateMinutes),
        gross:            r2(res.gross),
        lateDeduction:    r2(res.lateDeduction),
        halfDayDeduction: r2(res.halfDayDeduction),
        totalDeduction:   r2(res.totalDeduction),
        cashAdvance:      r2(cashAdvance),
        advanceSettled:     r2(adv.settled),      // already taken out of this payout
        advanceOutstanding: r2(adv.outstanding),  // still to be recovered
        advanceItems:       adv.items,
        reimbursementItems: rmb.items,
        allowanceRate:      who.allowance || 0,
        allowance:          r2(allowance),
        reimbursement:      r2(rmb.total),
        reimbursementPaid:  r2(rmb.paid),
        additionalPay:      r2(addp.total),
        additionalPayItems: addp.items,
        manualDeduction:      r2(ded.total),
        manualDeductionItems: ded.items,
        shortfall:            r2(shortfall),
        expected:         r2(expected),
        days: res.days,
        // Leave policy so the request form can enforce the same rules up front
        leavePolicy: {
          types:      hrLeaveTypesFor(data.username),
          isGeneric:  hrIsGenericAccount(data.username),
          today:      Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd'),
          vacationEarliest: hrAddDays(Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd'),
                                      HR_VACATION_NOTICE_DAYS),
          vacationNoticeDays: HR_VACATION_NOTICE_DAYS,
          emergencyPerMonth:  HR_EMERGENCY_PER_MONTH
        }
      });
    }

    // ── OPERATING HOURS (admin-editable basis for lateness & undertime) ──
    if (data.action === 'getOperatingHours') {
      const s = hrSettings(ss);
      return ok({ officialStart: hrSecToHms(s.officialStart).slice(0,5),
                  staffCutoff:   hrSecToHms(s.staffCutoff).slice(0,5),
                  halfDayAfter:  hrSecToHms(s.halfDayAfter).slice(0,5),
                  officialEnd:   hrSecToHms(s.officialEnd).slice(0,5),
                  dutyHours:     s.dutyHours });
    }

    // ── PER-DAY PAY VOID / HOLD (admin) + employee response ───────────
    if (data.action === 'setPayAdjustment') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const emp  = String(data.employee||'').trim();
      const date = String(data.date||'').trim();
      const type = String(data.type||'HOLD').toUpperCase() === 'VOID' ? 'VOID' : 'HOLD';
      const reason = String(data.reason||'').trim();
      if (!emp) return err('Employee is required');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('A valid date is required');
      if (!reason) return err('A reason is required — the employee will see and answer this');

      const sh = getOrCreateSheet(ss, 'Pay Adjustments', [
        'Adjustment ID','Created At','Created By','Employee','Date','Type','Reason',
        'Status','Employee Response','Responded At','Resolved By','Resolved At'
      ]);
      const now = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss');
      const rows = sh.getDataRange().getValues();
      // One active adjustment per employee-day — replace rather than stack
      for (let i = 1; i < rows.length; i++) {
        const d = rows[i][4] instanceof Date
          ? Utilities.formatDate(rows[i][4], HR_TZ, 'yyyy-MM-dd') : String(rows[i][4]||'').slice(0,10);
        if (String(rows[i][3]).trim().toLowerCase() === emp.toLowerCase()
            && d === date && String(rows[i][7]||'') === 'Active') {
          sh.getRange(i+1, 6).setValue(type);
          sh.getRange(i+1, 7).setValue(reason);
          return ok({ adjustmentId: String(rows[i][0]), updated: true });
        }
      }
      const id = 'PA-' + Utilities.formatDate(new Date(), HR_TZ, 'yyyyMMddHHmmss')
               + '-' + Math.floor(Math.random()*900+100);
      sh.appendRow([ id, now, String(data.by||'admin'), emp, date, type, reason,
        'Active', '', '', '', '' ]);
      return ok({ adjustmentId: id, updated: false });
    }

    // Employee answers the admin's reason
    if (data.action === 'respondPayAdjustment') {
      const resp = String(data.response||'').trim();
      if (!resp) return err('Please write your answer');
      const sh = ss.getSheetByName('Pay Adjustments');
      if (!sh) return err('No adjustments found');
      const rows = sh.getDataRange().getValues();
      const me = String(data.by||'').trim().toLowerCase();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) !== String(data.adjustmentId||'')) continue;
        // Only the affected employee may answer their own record
        if (String(rows[i][3]).trim().toLowerCase() !== me) return err('This is not your record');
        sh.getRange(i+1, 9).setValue(resp);
        sh.getRange(i+1, 10).setValue(Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss'));
        return ok({ responded: String(data.adjustmentId) });
      }
      return err('Record not found');
    }

    // Admin releases the hold (day pays again) or cancels the adjustment
    if (data.action === 'releasePayAdjustment') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const sh = ss.getSheetByName('Pay Adjustments');
      if (!sh) return err('No adjustments found');
      const newStatus = String(data.decision||'release') === 'cancel' ? 'Cancelled' : 'Released';
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) !== String(data.adjustmentId||'')) continue;
        if (String(rows[i][7]||'') !== 'Active') return err('This record is already ' + rows[i][7]);
        sh.getRange(i+1, 8).setValue(newStatus);
        sh.getRange(i+1, 11).setValue(String(data.by||'admin'));
        sh.getRange(i+1, 12).setValue(Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss'));
        return ok({ resolved: newStatus });
      }
      return err('Record not found');
    }

    // ── WORK SCHEDULES (named shift patterns, assigned per employee) ──
    if (data.action === 'getWorkSchedules') {
      const map = hrSchedules(ss);
      const list = Object.keys(map).map(function(k){
        const s = map[k];
        return { name: s.name,
                 start:   hrSecToHms(s.officialStart).slice(0,5),
                 lateFrom:hrSecToHms(s.staffCutoff).slice(0,5),
                 halfDay: hrSecToHms(s.halfDayAfter).slice(0,5),
                 end:     hrSecToHms(s.officialEnd).slice(0,5),
                 dutyHours: s.dutyHours };
      });
      return ok({ schedules: list });
    }

    if (data.action === 'saveWorkSchedule') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const name = String(data.name||'').trim();
      if (!name) return err('Schedule name is required');
      const toSec = function(v){
        const m = String(v||'').trim().match(/^(\d{1,2}):(\d{2})$/);
        return m ? Number(m[1])*3600 + Number(m[2])*60 : null;
      };
      const st = toSec(data.start), lf = toSec(data.lateFrom),
            hd = toSec(data.halfDay), en = toSec(data.end);
      const dh = Number(data.dutyHours);
      if (st===null || lf===null || hd===null || en===null) return err('All times are required (HH:MM)');
      if (!(dh > 0 && dh <= 24)) return err('Duty hours must be between 1 and 24');
      if (lf < st)  return err('Late-from cannot be earlier than the start');
      if (hd <= lf) return err('Half day must be later than late-from');
      if (en <= st) return err('End must be later than the start');

      const sh = getOrCreateSheet(ss, 'Work Schedules',
        ['Schedule','Start','Late From','Half Day From','End','Duty Hours']);
      const row = [name, hrSecToHms(st), hrSecToHms(lf), hrSecToHms(hd), hrSecToHms(en), dh];
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim().toLowerCase() === name.toLowerCase()) {
          sh.getRange(i+1, 1, 1, 6).setValues([row]);
          // Stamp it effective from the START of the current cutoff, so it
          // applies to every log already recorded in this cutoff
          const eff = hrRecordScheduleVersion(ss, { name:name, officialStart:st, staffCutoff:lf,
            halfDayAfter:hd, officialEnd:en, dutyHours:dh }, data.by);
          return ok({ saved: name, updated: true, effectiveFrom: eff });
        }
      }
      sh.appendRow(row);
      hrRecordScheduleVersion(ss, { name:name, officialStart:st, staffCutoff:lf,
        halfDayAfter:hd, officialEnd:en, dutyHours:dh }, data.by);
      return ok({ saved: name, updated: false, effectiveFrom: hrCutoffRange(0).startDate });
    }

    if (data.action === 'saveOperatingHours') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const toSecOrNull = function(v){
        const m = String(v||'').trim().match(/^(\d{1,2}):(\d{2})$/);
        return m ? Number(m[1])*3600 + Number(m[2])*60 : null;
      };
      const st = toSecOrNull(data.officialStart), cut = toSecOrNull(data.staffCutoff),
            hd = toSecOrNull(data.halfDayAfter),  en  = toSecOrNull(data.officialEnd);
      const dh = Number(data.dutyHours);
      if (st===null || cut===null || hd===null || en===null) return err('All times are required (HH:MM)');
      if (!(dh > 0 && dh <= 24)) return err('Duty hours must be between 1 and 24');
      if (cut < st)  return err('The late cutoff cannot be earlier than the official start');
      if (hd <= cut) return err('Half day must be later than the late cutoff');
      if (en <= st)  return err('Official end must be later than the official start');

      const sh = getOrCreateSheet(ss, 'Attendance Settings', ['Setting','Value']);
      const want = { 'official start': hrSecToHms(st), 'staff cutoff': hrSecToHms(cut),
                     'half day after': hrSecToHms(hd), 'official end': hrSecToHms(en),
                     'duty hours': dh };
      const rows = sh.getDataRange().getValues();
      const seen = {};
      for (let i = 1; i < rows.length; i++) {
        const k = String(rows[i][0]||'').toLowerCase().trim();
        Object.keys(want).forEach(function(w){
          if (k.indexOf(w) >= 0 && !seen[w]) { sh.getRange(i+1,2).setValue(want[w]); seen[w] = true; }
        });
      }
      // Append any setting the sheet didn't have yet (e.g. Official End on older sheets)
      const label = { 'official start':'Official Start', 'staff cutoff':'Staff Cutoff',
                      'half day after':'Half Day After', 'official end':'Official End',
                      'duty hours':'Duty Hours' };
      Object.keys(want).forEach(function(w){
        if (!seen[w]) sh.appendRow([label[w], want[w]]);
      });
      // Version it against the current cutoff, same as named schedules
      const effOH = hrRecordScheduleVersion(ss, { name:'Operating Hours', officialStart:st,
        staffCutoff:cut, halfDayAfter:hd, officialEnd:en, dutyHours:dh }, data.by);
      return ok({ saved: true, settings: want, effectiveFrom: effOH });
    }

    // ══ HR REQUESTS — cash advances & leave (staff submit, admin decides) ══
    // Cash Advances cols: 0 ID · 1 RequestedAt · 2 RequestedBy · 3 Amount ·
    //   4 Reason · 5 Status · 6 ResolvedBy · 7 ResolvedAt · 8 DeductedCutoff · 9 Settled
    // (hrCashAdvances() reads 2/3/5/9 — keep those positions stable.)
    if (data.action === 'submitCashAdvance') {
      const amt = Number(data.amount) || 0;
      if (amt <= 0) return err('Enter a valid amount');
      if (!String(data.reason||'').trim()) return err('A reason is required');
      const sh = getOrCreateSheet(ss, 'Cash Advances', [
        'Request ID','Requested At','Requested By','Amount','Reason',
        'Status','Resolved By','Resolved At','Deducted Cutoff','Settled'
      ]);
      const now = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss');
      const id  = 'CA-' + Utilities.formatDate(new Date(), HR_TZ, 'yyyyMMddHHmmss')
                + '-' + Math.floor(Math.random()*900+100);
      sh.appendRow([ id, now, String(data.requestedBy||''), amt,
        String(data.reason||'').trim(), 'Pending', '', '', '', '' ]);
      return ok({ requestId: id });
    }

    // Leave Requests cols: 0 ID · 1 RequestedAt · 2 RequestedBy · 3 Type ·
    //   4 Start · 5 End · 6 Days · 7 Reason · 8 Status · 9 ResolvedBy · 10 ResolvedAt
    if (data.action === 'submitLeaveRequest') {
      const start = String(data.startDate||'').trim(), end = String(data.endDate||'').trim();
      const who   = String(data.requestedBy||'').trim();
      const type  = String(data.leaveType||'').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
        return err('Pick valid start and end dates');
      if (end < start) return err('End date cannot be before the start date');
      if (!String(data.reason||'').trim()) return err('A reason is required');

      // ── POLICY ──────────────────────────────────────────────────────
      // Shared accounts have no individual entitlement — unpaid leave only.
      const allowed = hrLeaveTypesFor(who);
      if (allowed.indexOf(type) < 0) {
        return err(hrIsGenericAccount(who)
          ? 'This is a shared account — it can only file Unpaid Leave. Named employees can file the other types.'
          : 'Unknown leave type: ' + type);
      }

      const today = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd');

      // Emergency: same-day filing only, and capped per calendar month
      if (type === 'Emergency Leave') {
        if (start !== today)
          return err('Emergency Leave can only be filed for today (' + today + ').');
        const lvPrev = ss.getSheetByName('Leave Requests');
        if (lvPrev) {
          const month = start.slice(0,7);   // yyyy-MM
          let used = 0;
          lvPrev.getDataRange().getValues().slice(1).forEach(function(r){
            if (!r[0]) return;
            if (String(r[2]||'').trim().toLowerCase() !== who.toLowerCase()) return;
            if (String(r[3]||'') !== 'Emergency Leave') return;
            if (String(r[8]||'') === 'Rejected') return;      // rejected doesn't count
            const s = r[4] instanceof Date
              ? Utilities.formatDate(r[4], HR_TZ, 'yyyy-MM-dd') : String(r[4]||'').slice(0,10);
            if (s.slice(0,7) === month) used++;
          });
          if (used >= HR_EMERGENCY_PER_MONTH)
            return err('You have already used your Emergency Leave for this month ('
              + HR_EMERGENCY_PER_MONTH + ' per month). File Unpaid Leave instead if needed.');
        }
      }

      // Vacation: must be filed at least two weeks ahead
      if (type === 'Vacation Leave') {
        const earliest = hrAddDays(today, HR_VACATION_NOTICE_DAYS);
        if (start < earliest)
          return err('Vacation Leave needs ' + HR_VACATION_NOTICE_DAYS
            + ' days notice — the earliest you can start is ' + earliest + '.');
      }

      // Sick leave is auto-approved; the medical certificate is the follow-up
      const autoApproved = (type === 'Sick Leave');

      const days = Math.round((new Date(end+'T00:00:00') - new Date(start+'T00:00:00')) / 86400000) + 1;
      const sh = getOrCreateSheet(ss, 'Leave Requests', [
        'Request ID','Requested At','Requested By','Leave Type','Start Date','End Date',
        'Days','Reason','Status','Resolved By','Resolved At'
      ]);
      const now = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss');
      const id  = 'LV-' + Utilities.formatDate(new Date(), HR_TZ, 'yyyyMMddHHmmss')
                + '-' + Math.floor(Math.random()*900+100);
      sh.appendRow([ id, now, who, type, start, end, days,
        String(data.reason||'').trim(),
        autoApproved ? 'Approved' : 'Pending',
        autoApproved ? 'Auto-approved' : '',
        autoApproved ? now : '' ]);
      return ok({ requestId: id, days: days, autoApproved: autoApproved,
        note: autoApproved ? 'Approved automatically — please present your medical certificate.' : '' });
    }

    // ── MANUAL ADDITIONAL PAY (admin) ─────────────────────────────────
    if (data.action === 'addAdditionalPay') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const amt = Number(data.amount) || 0;
      if (amt <= 0)      return err('Enter an amount greater than zero');
      if (amt > 100000)  return err('That amount looks wrong — please confirm and re-enter');
      const emp = String(data.employee||'').trim();
      if (!emp) return err('Pick the employee');
      const payDate = String(data.date||'').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) return err('Pick the date this applies to');
      const type = String(data.type||'').trim();
      if (!type) return err('Pick the type of pay');

      const sh = getOrCreateSheet(ss, 'Additional Pay', [
        'ID','Created At','Created By','Employee','Date','Type','Amount','Note','Status'
      ]);
      const now = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss');
      const id  = 'AP-' + Utilities.formatDate(new Date(), HR_TZ, 'yyyyMMddHHmmss')
                + '-' + Math.floor(Math.random()*900+100);
      sh.appendRow([ id, now, String(data.createdBy||''), emp, payDate, type,
                     amt, String(data.note||'').trim(), 'Active' ]);
      return ok({ id: id, employee: emp, amount: amt, date: payDate, type: type });
    }

    // Cancel a mistyped entry — kept as a row so the trail survives
    if (data.action === 'cancelAdditionalPay') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const sh = ss.getSheetByName('Additional Pay');
      if (!sh) return err('No additional pay entries found');
      const rows = sh.getDataRange().getValues();
      const wantId = String(data.id||'').trim();
      if (!wantId) return err('Missing entry id');
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() !== wantId) continue;
        if (String(rows[i][8]||'').trim().toLowerCase() === 'cancelled')
          return err('That entry was already cancelled');
        sh.getRange(i+1, 9).setValue('Cancelled');
        return ok({ id: wantId });
      }
      return err('Entry not found: ' + wantId);
    }

    // ── MANUAL DEDUCTIONS (admin) ─────────────────────────────────────
    if (data.action === 'addDeduction') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const amt = Number(data.amount) || 0;
      if (amt <= 0)      return err('Enter an amount greater than zero');
      if (amt > 100000)  return err('That amount looks wrong — please confirm and re-enter');
      const emp = String(data.employee||'').trim();
      if (!emp) return err('Pick the employee');
      const dedDate = String(data.date||'').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dedDate)) return err('Pick the date this applies to');
      const type = String(data.type||'').trim();
      if (!type) return err('Pick the type of deduction');
      // A deduction takes money off someone's pay — the employee is entitled to
      // know why, so a reason is required here even though extras allow a blank.
      const note = String(data.note||'').trim();
      if (!note) return err('A reason is required — the employee will see this');

      const sh = getOrCreateSheet(ss, 'Pay Deductions', [
        'ID','Created At','Created By','Employee','Date','Type','Amount','Note','Status'
      ]);
      const now = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss');
      const id  = 'DD-' + Utilities.formatDate(new Date(), HR_TZ, 'yyyyMMddHHmmss')
                + '-' + Math.floor(Math.random()*900+100);
      sh.appendRow([ id, now, String(data.createdBy||''), emp, dedDate, type,
                     amt, note, 'Active' ]);
      return ok({ id: id, employee: emp, amount: amt, date: dedDate, type: type });
    }

    // Cancel a mistaken deduction — kept as a row so the trail survives
    if (data.action === 'cancelDeduction') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const sh = ss.getSheetByName('Pay Deductions');
      if (!sh) return err('No deduction entries found');
      const rows = sh.getDataRange().getValues();
      const wantId = String(data.id||'').trim();
      if (!wantId) return err('Missing entry id');
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() !== wantId) continue;
        if (String(rows[i][8]||'').trim().toLowerCase() === 'cancelled')
          return err('That entry was already cancelled');
        sh.getRange(i+1, 9).setValue('Cancelled');
        return ok({ id: wantId });
      }
      return err('Entry not found: ' + wantId);
    }

    // ── REIMBURSEMENT REQUESTS ────────────────────────────────────────
    if (data.action === 'submitReimbursement') {
      const amt = Number(data.amount) || 0;
      if (amt <= 0) return err('Enter the amount you paid');
      if (!String(data.description||'').trim()) return err('Describe what the expense was for');
      const expDate = String(data.expenseDate||'').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expDate)) return err('Pick the date of the expense');

      // Optional receipt photo → Drive, same pattern as attendance selfies
      let receipt = '';
      if (data.receipt) {
        try {
          const pm   = String(data.receipt).match(/^data:(image\/\w+);base64,(.+)$/);
          const blob = Utilities.newBlob(Utilities.base64Decode(pm ? pm[2] : String(data.receipt)),
            pm ? pm[1] : 'image/jpeg',
            'RCPT_' + String(data.requestedBy||'user') + '_' + expDate + '.jpg');
          const fIt  = DriveApp.getFoldersByName('AE-ON Receipts');
          const fold = fIt.hasNext() ? fIt.next() : DriveApp.createFolder('AE-ON Receipts');
          receipt = fold.createFile(blob).getUrl();
        } catch(rerr) { receipt = '(receipt save failed)'; }
      }

      const sh = getOrCreateSheet(ss, 'Reimbursements', [
        'Request ID','Requested At','Requested By','Amount','Category','Expense Date',
        'Description','Receipt','Status','Resolved By','Resolved At','Paid Cutoff','Paid'
      ]);
      const now = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss');
      const id  = 'RB-' + Utilities.formatDate(new Date(), HR_TZ, 'yyyyMMddHHmmss')
                + '-' + Math.floor(Math.random()*900+100);
      sh.appendRow([ id, now, String(data.requestedBy||''), amt,
        String(data.category||'Other'), expDate, String(data.description||'').trim(),
        receipt, 'Pending', '', '', '', '' ]);
      return ok({ requestId: id, receiptSaved: receipt && receipt.indexOf('failed') < 0 });
    }

    if (data.action === 'resolveReimbursement') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const sh = ss.getSheetByName('Reimbursements');
      if (!sh) return err('No reimbursements found');
      const approve = String(data.decision) === 'approve';
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) !== String(data.requestId||'')) continue;
        if (String(rows[i][8]||'') !== 'Pending')
          return err('Already ' + String(rows[i][8]).toLowerCase());
        const now = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss');
        sh.getRange(i+1, 9).setValue(approve ? 'Approved' : 'Rejected');
        sh.getRange(i+1, 10).setValue(String(data.by||'admin'));
        sh.getRange(i+1, 11).setValue(now);
        return ok({ resolved: approve ? 'Approved' : 'Rejected' });
      }
      return err('Request not found');
    }

    // Mark a reimbursement as actually paid out in a cutoff
    if (data.action === 'settleReimbursement') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const sh = ss.getSheetByName('Reimbursements');
      if (!sh) return err('No reimbursements found');
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) !== String(data.requestId||'')) continue;
        if (String(rows[i][8]||'') !== 'Approved') return err('Only approved items can be paid');
        sh.getRange(i+1, 12).setValue(String(data.cutoffStart||'') || hrCutoffRange(0).startDate);
        sh.getRange(i+1, 13).setValue('YES');
        return ok({ settled: String(data.requestId) });
      }
      return err('Request not found');
    }

    // One reader for both request types. Employees get their own; admin gets all.
    if (data.action === 'getHRRequests') {
      const isAdmin = String(data.role||'').toLowerCase() === 'admin';
      const meL = String(data.username||'').trim().toLowerCase();
      const fmt = function(v){
        return v instanceof Date ? Utilities.formatDate(v, HR_TZ, 'yyyy-MM-dd HH:mm:ss') : String(v||'');
      };
      const advances = [], leaves = [];

      const ca = ss.getSheetByName('Cash Advances');
      if (ca) ca.getDataRange().getValues().slice(1).forEach(function(r){
        if (!r[0]) return;
        const by = String(r[2]||'');
        if (!isAdmin && by.trim().toLowerCase() !== meL) return;
        advances.push({ requestId:String(r[0]), requestedAt:fmt(r[1]), requestedBy:by,
          amount:Number(r[3])||0, reason:String(r[4]||''), status:String(r[5]||'Pending'),
          resolvedBy:String(r[6]||''), resolvedAt:fmt(r[7]),
          deductedCutoff:String(r[8]||''), settled:String(r[9]||'').toUpperCase()==='YES' });
      });

      const lv = ss.getSheetByName('Leave Requests');
      if (lv) lv.getDataRange().getValues().slice(1).forEach(function(r){
        if (!r[0]) return;
        const by = String(r[2]||'');
        if (!isAdmin && by.trim().toLowerCase() !== meL) return;
        const d = function(v){ return v instanceof Date
          ? Utilities.formatDate(v, HR_TZ, 'yyyy-MM-dd') : String(v||'').slice(0,10); };
        leaves.push({ requestId:String(r[0]), requestedAt:fmt(r[1]), requestedBy:by,
          leaveType:String(r[3]||'Leave'), startDate:d(r[4]), endDate:d(r[5]),
          days:Number(r[6])||0, reason:String(r[7]||''), status:String(r[8]||'Pending'),
          resolvedBy:String(r[9]||''), resolvedAt:fmt(r[10]) });
      });

      const reimbursements = [];
      const rb = ss.getSheetByName('Reimbursements');
      if (rb) rb.getDataRange().getValues().slice(1).forEach(function(r){
        if (!r[0]) return;
        const by = String(r[2]||'');
        if (!isAdmin && by.trim().toLowerCase() !== meL) return;
        const d = function(v){ return v instanceof Date
          ? Utilities.formatDate(v, HR_TZ, 'yyyy-MM-dd') : String(v||'').slice(0,10); };
        reimbursements.push({ requestId:String(r[0]), requestedAt:fmt(r[1]), requestedBy:by,
          amount:Number(r[3])||0, category:String(r[4]||'Other'), expenseDate:d(r[5]),
          description:String(r[6]||''), receipt:String(r[7]||''), status:String(r[8]||'Pending'),
          resolvedBy:String(r[9]||''), resolvedAt:fmt(r[10]),
          paid:String(r[12]||'').toUpperCase()==='YES' });
      });

      advances.reverse(); leaves.reverse(); reimbursements.reverse();   // newest first
      return ok({ advances: advances.slice(0,100), leaves: leaves.slice(0,100),
                  reimbursements: reimbursements.slice(0,100) });
    }

    // Approve / reject either type. Approving an advance leaves it unsettled so
    // hrCashAdvances() deducts it from the next cutoff's expected pay.
    if (data.action === 'resolveHRRequest') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const approve = String(data.decision) === 'approve';
      const id = String(data.requestId||'');
      const isLeave = id.indexOf('LV-') === 0;
      const sh = ss.getSheetByName(isLeave ? 'Leave Requests' : 'Cash Advances');
      if (!sh) return err('Request sheet not found');
      const rows = sh.getDataRange().getValues();
      const statusCol = isLeave ? 9 : 6;   // 1-based col of Status
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) !== id) continue;
        const cur = String(isLeave ? rows[i][8] : rows[i][5] || 'Pending');
        if (cur !== 'Pending') return err('This request was already ' + cur.toLowerCase());
        const now = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss');
        sh.getRange(i+1, statusCol).setValue(approve ? 'Approved' : 'Rejected');
        sh.getRange(i+1, statusCol+1).setValue(String(data.by||'admin'));
        sh.getRange(i+1, statusCol+2).setValue(now);
        return ok({ resolved: approve ? 'Approved' : 'Rejected', type: isLeave ? 'leave' : 'advance' });
      }
      return err('Request not found');
    }

    // Mark an approved advance as deducted/settled once it's been taken from a payout
    if (data.action === 'settleCashAdvance') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const sh = ss.getSheetByName('Cash Advances');
      if (!sh) return err('Cash Advances sheet not found');
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) !== String(data.requestId||'')) continue;
        if (String(rows[i][5]||'') !== 'Approved') return err('Only approved advances can be settled');
        // Store the cutoff START DATE (yyyy-MM-dd) — a stable key, unlike a display
        // label. The advance keeps showing as a deduction in THAT cutoff forever, so
        // the historical record always matches what the employee actually received.
        const cutStart = String(data.cutoffStart||'') || hrCutoffRange(0).startDate;
        sh.getRange(i+1, 9).setValue(cutStart);   // Deducted Cutoff
        sh.getRange(i+1, 10).setValue('YES');     // Settled
        return ok({ settled: String(data.requestId) });
      }
      return err('Request not found');
    }

    // ── HR SUMMARY (admin) — every employee for one cutoff, one payload ──
    // Uses the SAME helpers as getMyHR, so an employee's screen and this
    // dashboard can never disagree on someone's pay.
    if (data.action === 'getHRSummary') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const range   = hrCutoffRange(Number(data.offset)||0);
      const payMap  = hrStaffPay(ss);
      const grouped = hrGroupAttendance(ss, range.startDate, range.endDate);
      const advMap  = hrCashAdvances(ss);
      const r2 = function(n){ return Math.round(n*100)/100; };

      const employees = [];
      let totalPayroll = 0, totalAdvances = 0, totalDeductions = 0, flagged = 0;

      const isCurrent = (Number(data.offset)||0) === 0;
      const cfgAll    = hrSettings(ss);
      const adjAll    = hrPayAdjustments(ss);
      const rmbAll    = hrReimbursements(ss);
      const addAll    = hrAdditionalPay(ss);
      const dedAll    = hrDeductions(ss);
      Object.keys(payMap).forEach(function(uL){
        const who = payMap[uL];
        const cfgWho = hrScheduleFor(ss, who, cfgAll, range.startDate);   // per-employee, per-cutoff
        const res = hrComputeDays(grouped[uL] || {}, who.dailyRate, who.payType, cfgWho,
                                  adjAll[uL]);
        const advInfo = hrAdvanceForCutoff(advMap[uL], range, isCurrent);
        const adv = advInfo.total;
        const allowW = (who.allowance || 0) * res.daysWorked;
        const rmbW   = hrReimburseForCutoff(rmbAll[uL], range, isCurrent);
        const addW   = hrAddPayForCutoff(addAll[uL], range);
        const dedW   = hrDeductForCutoff(dedAll[uL], range);
        const rawNetW = res.gross + allowW + rmbW.total + addW.total
                      - res.totalDeduction - adv - dedW.total;
        const expected  = Math.max(0, rawNetW);
        const shortfallW = rawNetW < 0 ? -rawNetW : 0;
        // Skip people with no activity AND no rate — keeps the list meaningful.
        // An extra or a deduction posted against them is real money, so either
        // one keeps them in the list.
        if (res.daysWorked === 0 && res.incompleteDays === 0 && who.dailyRate === 0
            && addW.total === 0 && dedW.total === 0) return;
        if (res.incompleteDays > 0 || who.dailyRate === 0) flagged++;
        totalPayroll    += expected;
        totalAdvances   += adv;
        totalDeductions += res.totalDeduction;
        employees.push({
          username:   who.username,
          role:       who.role,
          payType:    who.payType,
          schedule:      cfgWho.name || 'Operating Hours',
          scheduleStart: hrSecToHms(cfgWho.officialStart).slice(0,5),
          scheduleEnd:   hrSecToHms(cfgWho.officialEnd).slice(0,5),
          dailyRate:  who.dailyRate,
          rateSet:    who.dailyRate > 0,
          daysWorked: res.daysWorked,
          lateDays:   res.lateDays,
          halfDays:   res.halfDays,
          lateMinutes:Math.round(res.lateMinutes),
          undertimeDays:      res.undertimeDays,
          undertimeMinutes:   Math.round(res.undertimeMinutes),
          undertimeDeduction: r2(res.undertimeDeduction),
          heldDays:           res.heldDays,
          voidedDays:         res.voidedDays,
          heldDeduction:      r2(res.heldDeduction),
          awaitingResponse:   res.awaitingResponse,
          hoursPaid:  r2(res.hoursPaid),
          otHours:    r2(res.otHours),
          fullDays:   res.fullDays,
          incompleteDays: res.incompleteDays,
          gross:          r2(res.gross),
          totalDeduction: r2(res.totalDeduction),
          cashAdvance:    r2(adv),
          advanceSettled:     r2(advInfo.settled),
          advanceOutstanding: r2(advInfo.outstanding),
          advanceItems:       advInfo.items,
          reimbursementItems: rmbW.items,
          allowanceRate:  who.allowance || 0,
          allowance:      r2(allowW),
          reimbursement:  r2(rmbW.total),
          additionalPay:      r2(addW.total),
          additionalPayItems: addW.items,
          manualDeduction:      r2(dedW.total),
          manualDeductionItems: dedW.items,
          shortfall:            r2(shortfallW),
          expected:       r2(expected),
          days: res.days
        });
      });

      employees.sort(function(a,b){ return a.username.localeCompare(b.username); });

      return ok({
        period:    range.label,
        startDate: range.startDate,
        endDate:   range.endDate,
        offset:    Number(data.offset)||0,
        stdHours:  HR_STD_HOURS,
        headcount: employees.length,
        flagged:   flagged,
        totalPayroll:    r2(totalPayroll),
        totalDeductions: r2(totalDeductions),
        totalAdvances:   r2(totalAdvances),
        employees: employees
      });
    }

    // ── GET ALL SKUs ───────────────────────────────────────────────────
    if (data.action === 'getAllSKUs') {
      // The Supplier cell may list ALTERNATE suppliers separated by commas or
      // slashes — "TERRAFEED VENTURES INC., CVM Feeds". `suppliers` carries the
      // full list (PO screens match against any of them); `supplier` stays the
      // FIRST name (primary) so every older code path keeps working.
      const splitSup = function(v){
        return String(v||'').split(/[,/;]/).map(function(s){return s.trim();}).filter(Boolean);
      };
      const skus = [];
      const distSheet = ss.getSheetByName('SKU Master');
      if (distSheet) {
        distSheet.getDataRange().getValues().slice(4)
          .filter(r => r[0] && String(r[5]).toUpperCase() === 'YES')
          .forEach((r, i) => {
            const sups = splitSup(r[7]);
            skus.push({
              code:String(r[0]).trim(),name:String(r[1]).trim(),
              category:String(r[2]).trim(),type:'DIST',
              order:Number(r[4])||i,supplier:sups[0]||'',suppliers:sups,cost:Number(r[8])||0
            });
          });
      }
      const retailSheet = ss.getSheetByName('SKU Master - Retail');
      if (retailSheet) {
        retailSheet.getDataRange().getValues().slice(4)
          .filter(r => r[0] && String(r[7]).toUpperCase() === 'YES')
          .forEach((r, i) => {
            const sups = splitSup(r[8]);
            skus.push({
              code:String(r[0]).trim(),name:String(r[1]).trim(),
              category:String(r[2]).trim(),type:'RETAIL',
              unit:String(r[4]||'').trim(),order:Number(r[6])||1000+i,
              supplier:sups[0]||'',suppliers:sups,cost:Number(r[9])||0
            });
          });
      }
      skus.sort((a,b)=>a.order-b.order);
      return ok({skus});
    }

    // ── SKU ALIGNMENT AUDIT ────────────────────────────────────────────
    // Compares what's holding stock against what the SKU Masters actually list,
    // so nothing can quietly hold inventory while being invisible in the app.
    if (data.action === 'auditSKUAlignment') {
      const report = { orphans: [], neverCounted: [], inactiveWithStock: [] };
      const scan = function(masterName, cntName, activeCol, type){
        const ms = ss.getSheetByName(masterName), cs = ss.getSheetByName(cntName);
        const master = {};       // code → {name, active}
        if (ms) ms.getDataRange().getValues().slice(4).forEach(function(r){
          if (!r[0]) return;
          master[String(r[0]).trim().toLowerCase()] = {
            code: String(r[0]).trim(), name: String(r[1]||'').trim(),
            active: String(r[activeCol]).toUpperCase() === 'YES' };
        });
        const stock = {};        // latest qty per code (last row wins)
        if (cs) cs.getDataRange().getValues().slice(1).forEach(function(r){
          if (!r[0] || !r[3]) return;
          stock[String(r[3]).trim().toLowerCase()] =
            { code: String(r[3]).trim(), name: String(r[4]||''), qty: Number(r[5]) || 0 };
        });
        Object.keys(stock).forEach(function(k){
          const m = master[k], s = stock[k];
          if (!m) report.orphans.push({ type:type, code:s.code, name:s.name, stock:s.qty });
          else if (!m.active && s.qty !== 0)
            report.inactiveWithStock.push({ type:type, code:m.code, name:m.name, stock:s.qty });
        });
        Object.keys(master).forEach(function(k){
          if (master[k].active && !stock[k])
            report.neverCounted.push({ type:type, code:master[k].code, name:master[k].name });
        });
      };
      scan('SKU Master',          'Stock Counts - Distribution', 5, 'DIST');
      scan('SKU Master - Retail', 'Stock Counts - Retail',       7, 'RETAIL');
      return ok({ orphans: report.orphans, neverCounted: report.neverCounted,
                  inactiveWithStock: report.inactiveWithStock,
                  totalIssues: report.orphans.length + report.neverCounted.length
                             + report.inactiveWithStock.length });
    }

    // ── GET SKU MASTER (fallback) ──────────────────────────────────────
    if (data.action === 'getSKUMaster') {
      const sheet = ss.getSheetByName('SKU Master');
      if (!sheet) return ok({skus:[]});
      const skus = sheet.getDataRange().getValues().slice(4)
        .filter(r=>r[0]&&String(r[5]).toUpperCase()==='YES')
        .map((r,i)=>{
          const sups = String(r[7]||'').split(/[,/;]/).map(function(s){return s.trim();}).filter(Boolean);
          return {code:String(r[0]).trim(),name:String(r[1]).trim(),
            category:String(r[2]).trim(),type:'DIST',order:Number(r[4])||i,
            supplier:sups[0]||'',suppliers:sups,cost:Number(r[8])||0};
        })
        .sort((a,b)=>a.order-b.order);
      return ok({skus});
    }

    // ── GET TODAY'S LOADS ──────────────────────────────────────────────
    if (data.action === 'getTodayLoads') {
      const sheet = ss.getSheetByName('Stock Movements');
      if (!sheet) return ok({rows:[]});
      const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

      // Build loaded/returned map from Stock Movements
      const loadMap = {};
      sheet.getDataRange().getValues().slice(1)
        .filter(function(r){
          if(!r[0]) return false;
          const ts = r[0] instanceof Date
            ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[0]).slice(0,10);
          return ts===today && String(r[2])===data.unit && String(r[3])==='LOAD';
        })
        .forEach(function(r){
          const code = String(r[4]);
          if(!loadMap[code]) loadMap[code]={code,name:String(r[5]),cat:String(r[6]),loaded:0,returned:0,invoicedLoaded:0,otsExtra:0};
          const qty = Number(r[7])||0;
          loadMap[code].loaded   += qty;
          loadMap[code].returned += Number(r[8])||0;
          // Split invoice loads from OTS extras (Tag col 11) — pre-fill counts
          // only invoice loads against invoice requirements
          if (String(r[10]||'').toUpperCase() === 'OTS EXTRA') loadMap[code].otsExtra += qty;
          else loadMap[code].invoicedLoaded += qty;
        });

      // Calculate sold from today's Sales Invoice Lines for this driver
      const soldMap = {};
      const invSheet2     = ss.getSheetByName('Sales Invoices');
      const invLineSheet2 = ss.getSheetByName('Sales Invoice Lines');
      if(invSheet2 && invLineSheet2 && data.createdBy){
        const todayNums = new Set();
        invSheet2.getDataRange().getValues().slice(1).forEach(function(r){
          if(!r[0]) return;
          const invDate2 = r[4] instanceof Date
            ? Utilities.formatDate(r[4], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[4]||'').slice(0,10);
          if(invDate2===today && String(r[10]||'')===String(data.createdBy) && String(r[9])!=='VOID')
            todayNums.add(String(r[0]));
        });
        invLineSheet2.getDataRange().getValues().slice(1).forEach(function(r){
          if(!r[0]||!todayNums.has(String(r[0]))) return;
          const sku = String(r[2]).trim();
          soldMap[sku] = (soldMap[sku]||0) + (Number(r[4])||0);
        });
      }

      const rows = Object.values(loadMap).map(function(item){
        return {code:item.code,name:item.name,cat:item.cat,
                loaded:item.loaded,returned:item.returned,sold:soldMap[item.code]||0,
                invoicedLoaded:item.invoicedLoaded,otsExtra:item.otsExtra};
      })
      // Hide fully-zeroed items (e.g. a line removed via an approved correction) —
      // otherwise the manifest shows a useless 0|0|0 row for them
      .filter(function(item){ return item.loaded>0 || item.returned>0 || item.sold>0; });
      return ok({rows});
    }

    // ── GET LOAD LIST ──────────────────────────────────────────────────
    // Consolidates the day's Xero invoice line items (already imported into
    // 'Sales Log - Distribution') into one row per SKU — the stockman's
    // van-load reference. Returns the picked date plus recent dates that
    // actually have invoices, so the UI can guide date selection.
    if (data.action === 'getLoadList') {
      const llSheet = ss.getSheetByName('Sales Log - Distribution');
      const tz = Session.getScriptTimeZone();
      function llNormDate(v){
        if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
        const s = String(v||'').trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
        // Xero (PH) exports DD/MM/YYYY — convert to ISO so dates match & display right
        const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) return m[3] + '-' + ('0'+m[2]).slice(-2) + '-' + ('0'+m[1]).slice(-2);
        const d = new Date(s);
        return isNaN(d.getTime()) ? s : Utilities.formatDate(d, tz, 'yyyy-MM-dd');
      }
      // Xero's Location tag → the location names the rest of AE-ON already uses
      // ('Distribution WH' / 'Retail Store'). Matched loosely because the Xero
      // wording is typed by hand ("Warehouse", "WAREHOUSE", "Main Warehouse").
      // An unrecognised value is passed through untouched rather than forced
      // into one of the two buckets, so a location added later shows up as
      // itself instead of being silently mislabelled.
      function llNormLocation(v){
        const s = String(v == null ? '' : v).trim();
        if (!s) return '';                                  // untagged
        const l = s.toLowerCase();
        if (l.indexOf('retail') >= 0 || l.indexOf('store') >= 0) return 'Retail Store';
        if (l.indexOf('warehouse') >= 0 || l.indexOf('wh') >= 0
            || l.indexOf('distribution') >= 0) return 'Distribution WH';
        return s;
      }

      const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
      if (!llSheet) {
        return ok({ date: data.date || today, items: [], invoiceCount: 0,
                    dealerCount: 0, totalBags: 0, availableDates: [] });
      }
      // Sales Log - Distribution cols:
      // 0 InvoiceNumber 1 InvoiceDate 2 DueDate 3 Dealer 4 SKU 5 Description 6 Qty ...
      const llRows = llSheet.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && r[4]; });

      // Distinct invoice dates present (most recent 21) for quick-pick chips
      const llDateSet = {};
      llRows.forEach(function(r){ const d = llNormDate(r[1]); if (d) llDateSet[d] = true; });
      const availableDates = Object.keys(llDateSet).sort().reverse().slice(0, 21);

      // Requested date, else the most recent date with invoices, else today
      const targetDate = data.date || (availableDates.length ? availableDates[0] : today);

      // Known DIST SKU codes — flag codes that won't map to the load form
      const knownSku = {};
      // SKU code → category (col C), so the load list can be grouped by
      // category. Only active SKUs have one; anything else is uncategorised.
      const skuCategory = {};
      const skuSheet = ss.getSheetByName('SKU Master');
      if (skuSheet) {
        // Active SKUs only — same filter every other reader uses, so a
        // deactivated item is flagged as unknown here too instead of silently
        // passing as loadable.
        skuSheet.getDataRange().getValues().slice(4).forEach(function(r){
          if (r[0] && String(r[5]).toUpperCase() === 'YES') {
            const code = String(r[0]).trim().toLowerCase();
            knownSku[code] = true;
            skuCategory[code] = String(r[2] || '').trim();
          }
        });
      }

      // Dealer name → assigned vehicle (case-insensitive). This is how each invoice
      // line gets routed to a van. No match / no tag → '' (Unassigned bucket).
      const dealerVehicle = {};
      const dirSheet = ss.getSheetByName('Dealer Directory');
      if (dirSheet) {
        dirSheet.getDataRange().getValues().slice(1).forEach(function(r){
          const name = String(r[1]||'').trim().toLowerCase();
          if (name) dealerVehicle[name] = String(r[17]||'').trim();
        });
      }

      // Active vehicle list (so the UI can build tabs even for days with no orders)
      const vSheet = getOrCreateSheet(ss, 'Delivery Vehicles', ['Vehicle ID','Label','Active','Xero Division']);
      if (vSheet.getLastRow() < 2) {
        vSheet.appendRow(['Bajaj1','Bajaj 1','YES','Wholesale-Bajaj1']);
        vSheet.appendRow(['Bajaj2','Bajaj 2','YES','Wholesale-Bajaj2']);
      }
      const vehicles = vSheet.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && String(r[2]||'YES').toUpperCase() !== 'NO'; })
        .map(function(r){ return { id: String(r[0]).trim(), label: String(r[1]||r[0]).trim(), xeroDivision: String(r[3]||'').trim() }; });

      // Resolve a Xero Division value (e.g. "Wholesale-Bajaj1") to a vehicle id.
      // Prefer the explicit Xero Division mapping; fall back to a contains-match on the id.
      function divisionToVehicle(div){
        const dl = String(div||'').trim().toLowerCase();
        if(!dl) return '';
        for(var i=0;i<vehicles.length;i++){
          if(vehicles[i].xeroDivision && vehicles[i].xeroDivision.toLowerCase()===dl) return vehicles[i].id;
        }
        for(var j=0;j<vehicles.length;j++){
          if(dl.indexOf(vehicles[j].id.toLowerCase())>=0) return vehicles[j].id;
        }
        return '';
      }

      const bySku = {}, invoiceSet = {}, dealerSet = {};
      llRows.forEach(function(r){
        if (llNormDate(r[1]) !== targetDate) return;
        const qty = Number(r[6]) || 0;
        if (qty === 0) return;
        const sku    = String(r[4]).trim();
        const inv    = String(r[0]).trim();
        const dealer = String(r[3]).trim();
        // Routing precedence: Xero Division (the unit recorded on the invoice) →
        // the dealer's Assigned Vehicle → Unassigned.
        const division = String(r[15]||'').trim();
        const vehicle = divisionToVehicle(division) || dealerVehicle[dealer.toLowerCase()] || '';
        invoiceSet[inv] = true;
        if (dealer) dealerSet[dealer] = true;
        if (!bySku[sku]) bySku[sku] = {
          skuCode:  sku,
          itemName: String(r[5] || sku),
          category: skuCategory[sku.toLowerCase()] || '',
          totalQty: 0,
          known:    knownSku.hasOwnProperty(sku.toLowerCase()),
          lines:    []
        };
        bySku[sku].totalQty += qty;
        // Location rides on the LINE, not the SKU: the same product can be sold
        // from the warehouse on one invoice and off the retail shelf on another,
        // and the load list has to show both sources separately.
        bySku[sku].lines.push({ dealer: dealer, invoiceNumber: inv, qty: qty,
                                vehicle: vehicle, location: llNormLocation(r[17]) });
      });

      const items = Object.keys(bySku).map(function(k){ return bySku[k]; })
        .sort(function(a,b){ return a.itemName.localeCompare(b.itemName); });
      const totalBags = items.reduce(function(s,i){ return s + i.totalQty; }, 0);

      return ok({
        date:          targetDate,
        items:         items,
        vehicles:      vehicles,
        invoiceCount:  Object.keys(invoiceSet).length,
        dealerCount:   Object.keys(dealerSet).length,
        totalBags:     totalBags,
        availableDates: availableDates
      });
    }


    // ── GET PRODUCTION BOM (now reads from SKU Master - Retail) ──────────
    if (data.action === 'getBOM') {
      const sheet = ss.getSheetByName('SKU Master - Retail');
      if (!sheet) return ok({bom:[]});
      // Cols: A-Code B-Name C-Cat D-Type E-Unit F-Rev G-Order H-Active
      //       I-Supplier J-Cost K-SellingPrice
      //       L-IsProductionItem M-DisassemblyUOM N-AssemblyUOM O-StandardRatio

      // allRows — full sheet, used for cross-reference lookups
      const allRows = sheet.getDataRange().getValues().slice(4).filter(r => r[0]);

      // prodRows — col H Active=YES AND col L IsProductionItem=YES
      const prodRows = allRows.filter(r =>
        String(r[7]||'').toUpperCase()  === 'YES' &&
        String(r[11]||'').toUpperCase() === 'YES'
      );

      // Find any SKU across the full sheet (not just production rows)
      function findSku(code) {
        return allRows.find(r => String(r[0]).trim() === String(code||'').trim()) || null;
      }

      // Extract SKU code from cell values like "SKU001 (Name)" or plain "SKU001"
      function parseSkuCode(cell) {
        const m = String(cell||'').trim().match(/^([^\s(]+)/);
        return m ? m[1] : String(cell||'').trim();
      }

      const bom = [];

      prodRows.forEach(r => {
        const code     = String(r[0]).trim();
        const name     = String(r[1]).trim();
        const category = String(r[2]||'').trim(); // col C
        const ratio    = Number(r[14]) || 0;
        const disUOM   = String(r[12]||'').trim(); // col M — DisassemblyUOM
        const asmUOM   = String(r[13]||'').trim(); // col N — AssemblyUOM

        const sourceUnit     = String(r[4]||'').trim(); // col E
        const hasDisassembly = disUOM && disUOM !== '—';
        const hasAssembly    = asmUOM && asmUOM !== '—';

        if (hasDisassembly) {
          const outCode    = parseSkuCode(disUOM);
          const outRow     = findSku(outCode);
          const outputUnit = outRow ? String(outRow[4]||'').trim() : '';
          bom.push({
            sourceSku:   code,
            sourceName:  name,
            category:    category,
            sourceUnit:  sourceUnit,
            outputSku:   outCode,
            outputName:  outRow ? String(outRow[1]).trim() : outCode,
            outputUnit:  outputUnit,
            ratio:       ratio,
            canAssemble: false
          });

        } else if (hasAssembly) {
          const outCode    = parseSkuCode(asmUOM);
          const outRow     = findSku(outCode);
          const outputUnit = outRow ? String(outRow[4]||'').trim() : '';
          bom.push({
            sourceSku:   code,
            sourceName:  name,
            category:    category,
            sourceUnit:  sourceUnit,
            outputSku:   outCode,
            outputName:  outRow ? String(outRow[1]).trim() : outCode,
            outputUnit:  outputUnit,
            ratio:       outRow ? (Number(outRow[14])||ratio) : ratio,
            canAssemble: true
          });

        } else {
          bom.push({
            sourceSku:   code,
            sourceName:  name,
            category:    category,
            sourceUnit:  sourceUnit,
            outputSku:   '',
            outputName:  '(output not configured)',
            outputUnit:  '',
            ratio:       ratio || 1,
            canAssemble: false
          });
        }
      });

      return ok({bom});
    }

    // ── SUBMIT PRODUCTION ──────────────────────────────────────────────
    if (data.action === 'submitProduction') {
      const variance    = Number(data.unitsProduced||0) - Number(data.standardUnits||0);
      const variancePct = data.standardUnits > 0
        ? ((variance / data.standardUnits)*100).toFixed(2)+'%' : '0%';
      const log = getOrCreateSheet(ss,'Production Log',[
        'Timestamp','Submitted By','Direction','Source SKU','Source Name',
        'Qty Consumed','Output SKU','Output Name',
        'Standard Yield','Actual Yield','Variance','Variance %','Notes']);
      log.appendRow([
        data.timestamp, data.submittedBy,
        data.canAssemble ? 'ASSEMBLY' : 'DISASSEMBLY',
        data.sourceSku, data.sourceName, data.bagsConsumed,
        data.outputSku, data.outputName,
        data.standardUnits||data.unitsProduced,
        data.unitsProduced, variance, variancePct,
        data.notes||''
      ]);
      const cs = getOrCreateSheet(ss,'Stock Counts - Retail',[
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category']);
      // Read latest absolute balance per SKU — "Qty On Hand" must always be the new
      // absolute total, never a signed delta (every reader takes last row as the balance)
      const prodLatest = {};
      cs.getDataRange().getValues().slice(1).forEach(function(r){
        if(!r[0]||!r[3]) return;
        prodLatest[String(r[3]).trim()] = Number(r[5])||0;
      });
      const srcKey = String(data.sourceSku).trim();
      const outKey = String(data.outputSku).trim();
      const srcNew = (prodLatest[srcKey]||0) - Number(data.bagsConsumed||0);
      cs.appendRow([data.timestamp,data.submittedBy,'Production',
        data.sourceSku,data.sourceName,srcNew,data.sourceUnit||'','RETAIL','Production']);
      prodLatest[srcKey] = srcNew;
      const outNew = (prodLatest[outKey]||0) + Number(data.unitsProduced||0);
      cs.appendRow([data.timestamp,data.submittedBy,'Production',
        data.outputSku,data.outputName,outNew,data.outputUnit||'','RETAIL','Production']);
      prodLatest[outKey] = outNew;
      return ok({});
    }

    // ── CREATE PO ─────────────────────────────────────────────────────
    if (data.action === 'createPO') {
      const poSheet = getOrCreateSheet(ss,'Purchase Orders',[
        'PO Number','Type','Supplier','Status','Created By','Created Date',
        'Approved By','Approved Date','Delivery Date','Total Value','Notes',
        'Payment Terms Days','Payment Mode','Cheque Ref','Due Date',
        'Rejection Reason','Doc Ref','Date Received','Received By','Payment History',
        'Amount Paid','Overpayment','Payment Schedule',
        'Last Edited By','Last Edited At','Edit History','Receipt History']);
      const liSheet = getOrCreateSheet(ss,'PO Line Items',[
        'PO Number','SKU Code','Item Name','Category',
        'Qty Ordered','Unit','Unit Cost','Total Cost',
        'Qty Received','Qty Outstanding','Line Status']);
      // Stamp date server-side in unambiguous ISO format (avoids M/D vs D/M
      // misinterpretation when Google Sheets auto-detects locale date strings)
      const createdDate = Utilities.formatDate(
        new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'
      );
      // Enforce unique PO number server-side. The client generates numbers from its
      // locally cached list, so two users creating POs concurrently can collide —
      // and getPOs dedupes by number, which would silently hide the second PO.
      // Lock prevents two simultaneous createPO calls from racing past each other.
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      let finalPONumber = String(data.poNumber);
      try {
        const existingNums = {};
        poSheet.getDataRange().getValues().slice(1).forEach(function(r){
          if(r[0]) existingNums[String(r[0]).trim()] = true;
        });
        if (existingNums[finalPONumber]) {
          // Collision — bump the trailing sequence until free: PO-YYYYMMDD-NNN
          const m = finalPONumber.match(/^(PO-\d{8}-)(\d+)$/);
          if (m) {
            let seq = parseInt(m[2], 10);
            while (existingNums[m[1] + String(++seq).padStart(3,'0')]) {}
            finalPONumber = m[1] + String(seq).padStart(3,'0');
          } else {
            finalPONumber = finalPONumber + '-' + Date.now().toString().slice(-5);
          }
        }
        poSheet.appendRow([finalPONumber,data.type,data.supplier,data.status,
          data.createdBy, createdDate,'','',
          data.deliveryDate||'',data.totalValue||0,data.notes||'']);
        (data.lineItems||[]).forEach(function(li){
          li[0] = finalPONumber; // keep line items pointed at the actual saved number
          liSheet.appendRow(li);
        });
      } finally {
        lock.releaseLock();
      }
      return ok({poNumber: finalPONumber});
    }

    // ── GET POs ───────────────────────────────────────────────────────
    if (data.action === 'getPOs') {
      const sheet = ss.getSheetByName('Purchase Orders');
      if (!sheet) return ok({pos:[]});
      const rows = sheet.getDataRange().getValues();
      // Build raw list then deduplicate by PO number (first row = canonical).
      // This prevents legacy duplicate rows (from double-submit bug) causing
      // status mismatches between the list view and the detail view.
      const seen = new Set();
      const pos = rows.slice(1).filter(r => {
        if (!r[0]) return false;
        const num = String(r[0]);
        if (seen.has(num)) return false;
        seen.add(num);
        return true;
      }).map(r=>({
        poNumber:  String(r[0]),
        type:      String(r[1]),
        supplier:  String(r[2]),
        status:    String(r[3]),
        createdBy: String(r[4]),
        // Safe date read: Sheets may return a Date object if it auto-detected the cell
        createdDate: r[5] instanceof Date
          ? Utilities.formatDate(r[5], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
          : String(r[5]||''),
        approvedBy:   String(r[6]||''),
        deliveryDate: String(r[8]||''),
        totalValue:   Number(r[9]||0),
        notes:        String(r[10]||''),
        lineCount:    0
      }));
      const liSheet = ss.getSheetByName('PO Line Items');
      if (liSheet) {
        // O(1) lookup instead of pos.find() per line row — that scan was
        // O(POs × line rows) and grows quadratically as history accumulates
        const poByNum = {};
        pos.forEach(p => { poByNum[p.poNumber] = p; });
        // Deduplicate line items by PO+SKU so duplicate rows don't inflate counts
        const liSeen = new Set();
        liSheet.getDataRange().getValues().slice(1).forEach(li => {
          const key = String(li[0]) + '|' + String(li[1]);
          if (liSeen.has(key)) return;
          liSeen.add(key);
          const po = poByNum[String(li[0])];
          if (po) po.lineCount = (po.lineCount||0) + 1;
        });
      }
      return ok({pos});
    }

    // ── GET PO DETAIL ─────────────────────────────────────────────────
    if (data.action === 'getPODetail') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      const liSheet = ss.getSheetByName('PO Line Items');
      if (!poSheet) return err('Purchase Orders sheet not found');
      const poRows = poSheet.getDataRange().getValues();
      const poRow = poRows.slice(1).find(r=>String(r[0])===data.poNumber);
      if (!poRow) return err('PO not found: '+data.poNumber);
      const po={
        poNumber:         String(poRow[0]),
        type:             String(poRow[1]),
        supplier:         String(poRow[2]),
        status:           String(poRow[3]),
        createdBy:        String(poRow[4]),
        createdDate:      String(poRow[5]),
        approvedBy:       String(poRow[6]||''),
        deliveryDate:     String(poRow[8]||''),
        totalValue:       Number(poRow[9]||0),
        notes:            String(poRow[10]||''),
        paymentTermsDays: String(poRow[11]||''),
        paymentMode:      String(poRow[12]||''),
        chequeRef:        String(poRow[13]||''),
        dueDate:          String(poRow[14]||''),
        rejectionReason:  String(poRow[15]||''),
        docRef:           String(poRow[16]||''),
        dateReceived:     String(poRow[17]||''),
        receivedBy:       String(poRow[18]||''),
        paymentHistory:   String(poRow[19]||''),
        amountPaid:       Number(poRow[20]||0),
        overpayment:      Number(poRow[21]||0),
        paymentSchedule:  (() => { try{ return JSON.parse(String(poRow[22]||'[]')); }catch(e){ return []; } })(),
        lastEditedBy:     String(poRow[23]||''),
        lastEditedAt:     String(poRow[24]||''),
        editHistory:      String(poRow[25]||''),
        receiptHistory:   String(poRow[26]||'')
      };
      let lineItems=[];
      if(liSheet){
        lineItems=liSheet.getDataRange().getValues().slice(1)
          .filter(r=>String(r[0])===data.poNumber)
          .map(r=>({poNumber:String(r[0]),skuCode:String(r[1]),
            itemName:String(r[2]),category:String(r[3]),
            qtyOrdered:Number(r[4]||0),unit:String(r[5]||'bag'),
            unitCost:Number(r[6]||0),totalCost:Number(r[7]||0),
            qtyReceived:Number(r[8]||0),qtyOutstanding:Number(r[9]||0),
            lineStatus:String(r[10]||'Open'),
            discount:Number(r[11]||0),discountType:String(r[12]||'%')}));
      }
      return ok({po,lineItems});
    }

    // ── APPROVE PO ────────────────────────────────────────────────────
    if (data.action === 'approvePO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      var poSupplier = '', poTotal = 0;
      // No break — update ALL rows matching this PO number so duplicates stay in sync
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          poSupplier = String(rows[i][2]||'');
          poTotal    = Number(rows[i][9]||0);
          sheet.getRange(i+1, 4).setValue('APPROVED');
          sheet.getRange(i+1, 7).setValue(data.approvedBy);
          sheet.getRange(i+1, 8).setValue(now);
          if(data.deliveryDate) sheet.getRange(i+1, 9).setValue(data.deliveryDate);
          sheet.getRange(i+1,12).setValue(data.paymentTermsDays || '');
          sheet.getRange(i+1,13).setValue(data.paymentMode      || '');
          sheet.getRange(i+1,14).setValue(data.chequeRef        || '');
          sheet.getRange(i+1,15).setValue(data.dueDate          || '');
          if(data.paymentSchedule) sheet.getRange(i+1,23).setValue(JSON.stringify(data.paymentSchedule));
        }
      }

      // ── CHEQUE PAYMENT REQUEST → NOTIFY OWNER ────────────────────────
      // When a non-admin (supervisor) approves a PO to be paid by cheque, email the
      // owner so the cheque can be prepared/signed. Admin approvals are self-evident.
      var chequeNotified = false;
      if (data.paymentMode === 'Cheque' && String(data.approverRole||'').toLowerCase() !== 'admin') {
        try {
          var adminEmail = Session.getEffectiveUser().getEmail();
          if (adminEmail) {
            var amtStr  = '₱' + poTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            var subject = 'Cheque Payment Request — ' + data.poNumber + ' · ' + poSupplier;
            var bodyArr = [
              'A cheque payment needs to be prepared.',
              '',
              'PO: ' + data.poNumber,
              'Supplier: ' + poSupplier,
              'Amount: ' + amtStr,
              'Cheque Ref: ' + (data.chequeRef ? data.chequeRef : '(to be issued)'),
              'Terms: ' + (data.paymentTermsDays === '0' ? 'Upon Delivery'
                          : (data.paymentTermsDays ? data.paymentTermsDays + ' days' : 'N/A')),
              (data.dueDate ? 'Due: ' + data.dueDate : ''),
              'Requested by: ' + (data.approvedBy || '') + ' (supervisor)',
              'When: ' + now,
              '',
              'Open AE-ON → Purchase Orders → ' + data.poNumber + ' to record the cheque number when issued.'
            ].filter(function(x){ return x !== ''; });
            MailApp.sendEmail(adminEmail, subject, bodyArr.join('\n'));
            chequeNotified = true;
          }
        } catch(mailErr) {
          chequeNotified = false; // never fail the approval over a notification
        }
      }
      // ── DELIVERY REMINDER ──────────────────────────────────────────
      // Approved goods are now on order — put the expected delivery on the
      // calendar so nothing ordered is quietly forgotten. It's cleared
      // automatically the moment the goods are received.
      var deliveryNote = '';
      try {
        var delDate = null;
        if (data.deliveryDate && /^\d{4}-\d{2}-\d{2}/.test(String(data.deliveryDate))) {
          delDate = new Date(String(data.deliveryDate).slice(0,10) + 'T00:00:00');
        }
        if (!delDate || isNaN(delDate.getTime())) {   // no date given → nudge in a week
          delDate = new Date(); delDate.setDate(delDate.getDate() + 7);
        }
        const delTitle = 'Delivery Expected — ' + data.poNumber + ' · ' + poSupplier
          + ' · ₱' + Number(poTotal).toLocaleString('en-PH',{minimumFractionDigits:2});
        deliveryNote = poUpsertCalEvent(data.poNumber, 'DEL', delTitle, delDate, [
          'PO: ' + data.poNumber,
          'Supplier: ' + poSupplier,
          'Amount: ₱' + Number(poTotal).toLocaleString('en-PH',{minimumFractionDigits:2}),
          'Approved by: ' + (data.approvedBy || ''),
          data.deliveryDate ? '' : '(No delivery date set — reminder placed 7 days out)',
          'Clears automatically once the goods are received.'
        ]);
      } catch (delErr) {
        deliveryNote = 'ERROR: ' + delErr.toString();   // never fail an approval over a reminder
      }

      return ok({ chequeNotified: chequeNotified, deliveryNote: deliveryNote });
    }

    // ── REJECT PO ─────────────────────────────────────────────────────
    if (data.action === 'rejectPO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      // No break — update ALL rows matching this PO number
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1, 4).setValue('REJECTED');
          sheet.getRange(i+1, 7).setValue(data.rejectedBy);
          sheet.getRange(i+1, 8).setValue(now);
          sheet.getRange(i+1,16).setValue(data.reason||'');
        }
      }
      return ok({});
    }

    // ── RESUBMIT PO (creator resubmits after rejection) ───────────────
    if (data.action === 'resubmitPO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      // No break — update ALL rows matching this PO number
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1, 4).setValue('PENDING');
          const existing = String(rows[i][10]||'');
          sheet.getRange(i+1,11).setValue(
            (existing?existing+' | ':'')+'Resubmitted by '+data.resubmittedBy+' on '+now
          );
        }
      }
      return ok({});
    }

    // ── CANCEL PO ─────────────────────────────────────────────────────
    if (data.action === 'cancelPO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      // No break — update ALL rows matching this PO number
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1,4).setValue('CANCELLED');
          const n=rows[i][10]||'';
          sheet.getRange(i+1,11).setValue(n+(n?' | ':'')+'Cancelled by: '+data.cancelledBy);
        }
      }
      return ok({});
    }

    // ── RECEIVE PO ────────────────────────────────────────────────────
    if (data.action === 'receivePO') {
      const rlock = LockService.getScriptLock();
      rlock.waitLock(20000);
      try {
      const poSheet=ss.getSheetByName('Purchase Orders');
      const liSheet=ss.getSheetByName('PO Line Items');
      if(!poSheet||!liSheet)return err('Sheets not found');
      const liRows=liSheet.getDataRange().getValues();
      const now=Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

      // Receipt summary for this delivery (also the dedup signature)
      var rcptSummary = (data.receipts||[]).map(function(r){
        return (r.itemName||r.skuCode) + ' ×' + r.qtyReceived;
      }).join(', ');
      var incomingRest = ((data.docRef?data.docRef+' —':'')+' '+rcptSummary).trim();

      // Read PO header rows once (reused for the status/history + calendar steps)
      const poRows=poSheet.getDataRange().getValues();

      // ── IDEMPOTENCY GUARD ───────────────────────────────────────────
      // A slow response makes users tap Receive twice (the 13:22 / 13:24 case).
      // If an identical receipt (same person, doc ref, items) was recorded on
      // THIS PO within 3 minutes, treat the repeat as a duplicate and change
      // nothing. The script lock above also blocks two in-flight requests racing.
      var nowMs = new Date().getTime();
      for(var gi=1; gi<poRows.length; gi++){
        if(String(poRows[gi][0])!==data.poNumber) continue;
        var gHist=String(poRows[gi][26]||'');
        if(gHist){
          var gEntries=gHist.split('|||');
          var gLast=gEntries[gEntries.length-1];
          var gm=gLast.match(/^\[([^\]·]+)·([^\]]*)\]\s*(.*)$/);
          if(gm){
            var gBy=gm[2].trim(), gRest=gm[3].trim();
            var gD=new Date(gm[1].trim().replace(' ','T')+':00');
            if(gBy===String(data.receivedBy||'').trim() && gRest===incomingRest
               && !isNaN(gD.getTime()) && (nowMs-gD.getTime())<3*60*1000){
              return ok({ duplicate:true, poNumber:data.poNumber,
                newStatus:String(poRows[gi][3]||''), message:'Duplicate receipt ignored — you were already recorded.' });
            }
          }
        }
        break;
      }

      // Update line items with received qty and actual cost.
      // Primary match: receipt.lineIndex — the position of the line within this PO's
      // rows (getPODetail returns them in sheet order, so indices line up exactly).
      // This is the only fully reliable way to handle duplicate SKUs in one PO.
      // Fallback for old cached clients without lineIndex: first not-yet-fully-received
      // row with a matching SKU.
      const poLineRowNums = [];   // 1-based sheet row numbers for this PO, in order
      for(let i=1;i<liRows.length;i++){
        if(String(liRows[i][0])===data.poNumber) poLineRowNums.push(i+1);
      }
      function applyReceipt(rowNum, receipt){
        const rIdx=rowNum-1; // back to liRows index
        const newRec=Number(liRows[rIdx][8]||0)+Number(receipt.qtyReceived);
        const newOut=Math.max(0,Number(liRows[rIdx][4]||0)-newRec);
        liSheet.getRange(rowNum,9).setValue(newRec);
        liSheet.getRange(rowNum,10).setValue(newOut);
        if(receipt.unitCost && receipt.unitCost!==liRows[rIdx][6]){
          liSheet.getRange(rowNum,7).setValue(receipt.unitCost);
        }
        if(newOut<=0)liSheet.getRange(rowNum,11).setValue('Received');
      }
      const usedRows = {};
      (data.receipts||[]).forEach(function(receipt){
        let rowNum = null;
        const li = Number(receipt.lineIndex);
        if(!isNaN(li) && poLineRowNums[li] !== undefined
           && String(liRows[poLineRowNums[li]-1][1])===String(receipt.skuCode)){
          rowNum = poLineRowNums[li];
        } else {
          // Fallback: first unused, not-fully-received row with this SKU
          for(let k=0;k<poLineRowNums.length;k++){
            const rn=poLineRowNums[k];
            if(usedRows[rn]) continue;
            if(String(liRows[rn-1][1])!==String(receipt.skuCode)) continue;
            const outstanding=Number(liRows[rn-1][9]||0);
            if(outstanding>0){ rowNum=rn; break; }
          }
        }
        if(rowNum){ usedRows[rowNum]=true; applyReceipt(rowNum, receipt); }
      });

      // Force all pending setValue writes to commit before re-reading.
      // Without this, getDataRange().getValues() may return stale pre-update data,
      // causing allFulfilled to evaluate against old outstanding quantities.
      SpreadsheetApp.flush();

      // Determine new status
      const updatedLi=liSheet.getDataRange().getValues().slice(1)
        .filter(r=>String(r[0])===data.poNumber);
      // r[9] is Qty Outstanding — explicit blank check so 0 (fully received) is NOT
      // treated as falsy (0||1 → 1 → 1<=0 is false, which would wrongly block RECEIVED)
      const allFulfilled=updatedLi.every(r=>(r[9]===''||r[9]==null?1:Number(r[9]))<=0);
      const anyReceived=updatedLi.some(r=>Number(r[8]||0)>0);
      const newStatus=allFulfilled?'RECEIVED':anyReceived?'PARTIAL':'APPROVED';

      // Build a Receipt History entry for THIS delivery — who received what, when.
      // Each partial delivery appends its own line, so split deliveries are fully traceable.
      // (rcptSummary was computed above for the dedup guard.)
      var rcptEntry = '[' + now.slice(0,16) + ' · ' + (data.receivedBy||'') + ']'
        + (data.docRef ? ' ' + data.docRef + ' —' : '') + ' ' + rcptSummary;

      // Update PO header: status + docRef + received date + receipt history (col 27)
      // (poRows was read once at the top of this action and is reused here.)
      for(let i=1;i<poRows.length;i++){
        if(String(poRows[i][0])===data.poNumber){
          poSheet.getRange(i+1, 4).setValue(newStatus);
          if(data.docRef) poSheet.getRange(i+1,17).setValue(data.docRef);
          poSheet.getRange(i+1,18).setValue(now);
          poSheet.getRange(i+1,19).setValue(data.receivedBy);
          var prevRcpt = String(poRows[i][26]||'');
          poSheet.getRange(i+1,27).setValue(prevRcpt ? prevRcpt + '|||' + rcptEntry : rcptEntry);
          break;
        }
      }
      // Backfill the Receipt History header on PO sheets created before this column existed
      if (poSheet.getRange(1,27).getValue() === '') poSheet.getRange(1,27).setValue('Receipt History');

      // Write STOCK IN entries to Stock Counts sheet — adds to running on-hand balance
      const csName=data.poType==='RETAIL'?'Stock Counts - Retail':'Stock Counts - Distribution';
      const cs=getOrCreateSheet(ss,csName,[
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category']);

      // Read current latest on-hand balance per SKU (last row per SKU wins)
      const csRows=cs.getDataRange().getValues().slice(1).filter(function(r){return r[0]&&r[3];});
      var latestStock={};
      csRows.forEach(function(r){
        var sku=String(r[3]).trim();
        latestStock[sku]={qty:Number(r[5])||0, unit:String(r[6]||'bag'), category:String(r[8]||'')};
      });

      var stockInLabel='STOCK IN — '+data.poNumber+(data.docRef?' ('+data.docRef+')':'');
      // Build all STOCK IN rows first, then write them in ONE setValues call —
      // appendRow-per-item cost ~100-300ms each and made receiving feel slow
      var stockInRows = [];
      (data.receipts||[]).forEach(function(r){
        var current=latestStock[r.skuCode]||{qty:0, unit:r.unit||'bag', category:''};
        var newQty=current.qty+Number(r.qtyReceived);
        stockInRows.push([
          now, data.receivedBy, stockInLabel,
          r.skuCode, r.itemName, newQty,
          r.unit||current.unit||'bag', data.poType, 'PO Receipt'
        ]);
        // Update local map so multiple receipts in the same batch stack correctly
        latestStock[r.skuCode]={qty:newQty, unit:r.unit||current.unit||'bag', category:current.category};
      });
      if(stockInRows.length){
        cs.getRange(cs.getLastRow()+1, 1, stockInRows.length, 9).setValues(stockInRows);
      }

      // ── AUTO-UPDATE COST ON FILE (price list reference) ──────────────
      // When goods arrive at a different unit cost, push the new cost into the SKU
      // Master so the Product List, future PO auto-fill and margin maths stay current.
      var costUpdates = [];
      var smName  = data.poType === 'RETAIL' ? 'SKU Master - Retail' : 'SKU Master';
      var costCol = data.poType === 'RETAIL' ? 10 : 9;  // J = retail cost, I = dist cost (1-indexed)
      var smSheet = ss.getSheetByName(smName);
      if (smSheet) {
        var smRows = smSheet.getDataRange().getValues();
        (data.receipts||[]).forEach(function(r){
          var newCost = Number(r.unitCost);
          if (!newCost || newCost <= 0) return;
          for (var si = 1; si < smRows.length; si++) {
            if (String(smRows[si][0]).trim() === String(r.skuCode).trim()) {
              var oldCost = Number(smRows[si][costCol-1]) || 0;
              if (Math.abs(newCost - oldCost) >= 0.005) {
                smSheet.getRange(si+1, costCol).setValue(newCost);
                costUpdates.push({ skuCode: r.skuCode, itemName: r.itemName, oldCost: oldCost, newCost: newCost });
              }
              break;
            }
          }
        });
      }

      // ── GOOGLE CALENDAR PAYMENT REMINDER ─────────────────────────────
      // Due date is always based on actual receipt date so the reminder is accurate.
      //   COD / Cash / E-Wallet / Bank Transfer / Cheque "Upon Delivery" → due = receipt date
      //   Cheque with terms → due = receipt date + termsDays
      var calendarNote = '';
      try {
        const poRowData = poRows.find(function(r){ return String(r[0])===data.poNumber; });
        if(poRowData){
          const paymentMode  = String(poRowData[12] || '');
          const termsDays    = Number(poRowData[11]) || 0;
          const receiptDate  = new Date();
          const dueDate      = new Date(receiptDate);
          if(termsDays > 0) dueDate.setDate(dueDate.getDate() + termsDays);

          const amount    = Number(poRowData[9]  || 0);
          const supplier  = String(poRowData[2]);
          const chequeRef = String(poRowData[13] || '');
          const docRef    = data.docRef || '';

          const title = 'Payment Due — ' + data.poNumber
            + ' · ' + supplier
            + ' · ₱' + amount.toLocaleString('en-PH',{minimumFractionDigits:2})
            + ' · ' + (paymentMode || 'Payment')
            + (chequeRef ? ' — Cheque: ' + chequeRef : '')
            + (docRef    ? ' — Ref: '    + docRef    : '');

          const descLines = [
            'PO: '           + data.poNumber,
            'Supplier: '     + supplier,
            'Amount: ₱' + amount.toLocaleString('en-PH',{minimumFractionDigits:2}),
            'Payment Mode: ' + (paymentMode || 'N/A'),
            'Terms: '        + (termsDays > 0 ? termsDays+' days from receipt' : 'Upon Delivery'),
            'Status: '       + newStatus,
            'Last receipt: ' + Utilities.formatDate(receiptDate, Session.getScriptTimeZone(), 'MMM d, yyyy'),
            'Due Date: '     + Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'MMM d, yyyy'),
            chequeRef ? 'Cheque Ref: ' + chequeRef : '',
            docRef    ? 'Doc Ref: '    + docRef    : '',
            'Received By: '  + (data.receivedBy || '')
          ];

          // Split / Installment POs carry their own schedule (col 23) with a due
          // date and amount per instalment. One lump reminder for the full total
          // would be wrong on every count, so give each unpaid instalment its own.
          var schedule = [];
          try { schedule = JSON.parse(String(poRowData[22] || '[]')) || []; } catch(e) { schedule = []; }

          if (Array.isArray(schedule) && schedule.length) {
            var made = 0;
            schedule.forEach(function(inst){
              const kind = 'PAY' + (inst.num || 0);
              if (String(inst.status || '') === 'Paid') {
                poClearCalEvent(data.poNumber, kind, receiptDate);   // already settled
                return;
              }
              var iDue = new Date(String(inst.dueDate || '').slice(0,10) + 'T00:00:00');
              if (isNaN(iDue.getTime())) iDue = new Date(dueDate);
              const iTitle = 'Payment Due (' + (inst.label || ('Instalment ' + inst.num)) + ') — '
                + data.poNumber + ' · ' + supplier
                + ' · ₱' + Number(inst.amount||0).toLocaleString('en-PH',{minimumFractionDigits:2});
              poUpsertCalEvent(data.poNumber, kind, iTitle, iDue, [
                'PO: ' + data.poNumber,
                'Supplier: ' + supplier,
                'Instalment ' + (inst.num||'') + ' of ' + schedule.length + ': ' + (inst.label||''),
                'Amount: ₱' + Number(inst.amount||0).toLocaleString('en-PH',{minimumFractionDigits:2}),
                'PO total: ₱' + amount.toLocaleString('en-PH',{minimumFractionDigits:2}),
                'Payment Mode: ' + (paymentMode || 'Split / Installment'),
                chequeRef ? 'Cheque Ref: ' + chequeRef : '',
                'Received By: ' + (data.receivedBy || '')
              ]);
              made++;
            });
            // A split PO must not also carry a full-total reminder
            poClearCalEvent(data.poNumber, 'PAY', receiptDate);
            calendarNote = made + ' instalment reminder' + (made!==1?'s':'') + ' set';
          } else {
            // Single payment — one reminder, updated on each partial delivery
            calendarNote = poUpsertCalEvent(data.poNumber, 'PAY', title, dueDate, descLines);
          }

          // Goods have arrived, so the "delivery expected" nudge is done
          poClearCalEvent(data.poNumber, 'DEL', receiptDate);
        } else {
          calendarNote = 'PO row not found in poRows — no event created';
        }
      } catch(calErr) {
        calendarNote = 'ERROR: ' + calErr.toString();
        Logger.log('Calendar event creation failed: ' + calErr.toString());
      }
      // ─────────────────────────────────────────────────────────────────

      return ok({newStatus, calendarNote, costUpdates: costUpdates});
      } finally { rlock.releaseLock(); }
    }

    // ── REVERSE DUPLICATE PO RECEIPT (admin cleanup for double-submits) ──
    // Detects receipt-history entries that are identical (same person, doc ref,
    // items) and recorded close in time — the double-tap signature. Reverses the
    // extra receipt(s): reduces the line-item received qty, fixes outstanding +
    // status, subtracts the phantom stock, and removes the duplicate history line.
    // dryRun returns the plan without writing so the UI can confirm first.
    if (data.action === 'reverseDuplicateReceipt') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only — reversal not permitted');
      const rlock = LockService.getScriptLock();
      rlock.waitLock(20000);
      try {
        const dryRun  = !!data.dryRun;
        const poSheet = ss.getSheetByName('Purchase Orders');
        const liSheet = ss.getSheetByName('PO Line Items');
        if(!poSheet||!liSheet) return err('Sheets not found');
        const poRows = poSheet.getDataRange().getValues();
        let poIdx = -1;
        for(let i=1;i<poRows.length;i++){ if(String(poRows[i][0])===data.poNumber){ poIdx=i; break; } }
        if(poIdx<0) return err('PO not found: '+data.poNumber);

        const hist = String(poRows[poIdx][26]||'');
        if(!hist) return ok({ reversed:false, message:'No receipt history on this PO.' });

        // Parse each entry: [ts · by] rest
        const entries = hist.split('|||').map(function(e){
          const m = e.match(/^\[([^\]·]+)·([^\]]*)\]\s*(.*)$/);
          return { raw:e, ts:(m?m[1].trim():''), by:(m?m[2].trim():''), rest:(m?m[3].trim():e.trim()) };
        });

        // Flag as duplicate any entry matching an earlier KEPT entry (same by+rest)
        // within 10 minutes — the accidental double-tap signature.
        const keep = entries.map(function(){ return true; });
        const dupByName = {};   // itemName -> qty to add back
        for(let i=0;i<entries.length;i++){
          for(let j=0;j<i;j++){
            if(!keep[j]) continue;
            if(entries[j].by===entries[i].by && entries[j].rest===entries[i].rest && entries[i].rest){
              const di=new Date(entries[i].ts.replace(' ','T')+':00');
              const dj=new Date(entries[j].ts.replace(' ','T')+':00');
              if(!isNaN(di.getTime()) && !isNaN(dj.getTime()) && Math.abs(di.getTime()-dj.getTime())<10*60*1000){
                keep[i]=false;
                // Parse "Item ×qty, Item ×qty" (drop optional "docRef — " prefix)
                let body=entries[i].rest; const dash=body.indexOf('— ');
                if(dash>=0) body=body.slice(dash+2);
                body.split(',').forEach(function(tok){
                  const mm=tok.trim().match(/^(.*?)×\s*([\d.]+)\s*$/);
                  if(mm){ const nm=mm[1].trim(); dupByName[nm]=(dupByName[nm]||0)+Number(mm[2]); }
                });
                break;
              }
            }
          }
        }
        const removedCount = keep.filter(function(f){ return !f; }).length;
        if(!removedCount) return ok({ reversed:false, message:'No duplicate receipts detected on this PO.' });

        // Map itemName -> SKU via this PO's line items (build line-row index too)
        const liRows = liSheet.getDataRange().getValues();
        const nameToSku = {}; const poLineNums = [];
        for(let i=1;i<liRows.length;i++){
          if(String(liRows[i][0])!==data.poNumber) continue;
          nameToSku[String(liRows[i][2]).trim()] = String(liRows[i][1]).trim();
          poLineNums.push(i+1);
        }
        const dupBySku = {}; const unmapped = [];
        Object.keys(dupByName).forEach(function(nm){
          const sku=nameToSku[nm];
          if(sku) dupBySku[sku]=(dupBySku[sku]||0)+dupByName[nm];
          else unmapped.push(nm);
        });

        // Read current stock (latest per SKU) for the correct sheet
        const csName = data.poType==='RETAIL' ? 'Stock Counts - Retail' : 'Stock Counts - Distribution';
        const cs = getOrCreateSheet(ss, csName, [
          'Timestamp','Submitted By','Location','SKU Code','Item Name','Qty On Hand','Unit','Type','Category']);
        const latest = {};
        cs.getDataRange().getValues().slice(1).filter(function(r){return r[0]&&r[3];})
          .forEach(function(r){ latest[String(r[3]).trim()]={qty:Number(r[5])||0, unit:String(r[6]||'bag'), cat:String(r[8]||''), name:String(r[4]||'')}; });

        // Build the plan (per SKU): received before/after, stock before/after
        const plan = Object.keys(dupBySku).map(function(sku){
          const dq = dupBySku[sku];
          const cur = latest[sku] || {qty:0, name:sku};
          // sum current received across this PO's rows for the SKU
          let recv=0; poLineNums.forEach(function(rn){ if(String(liRows[rn-1][1]).trim()===sku) recv+=Number(liRows[rn-1][8]||0); });
          return { sku:sku, item:cur.name||sku, dupQty:dq,
            receivedBefore:recv, receivedAfter:Math.max(0,recv-dq),
            stockBefore:cur.qty, stockAfter:cur.qty-dq };
        });

        if(dryRun){
          return ok({ reversed:false, dryRun:true, removedCount:removedCount,
            plan:plan, unmapped:unmapped });
        }

        // ── APPLY ──────────────────────────────────────────────────────
        const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        // 1) Reduce received on line items (spill across rows if a SKU repeats)
        Object.keys(dupBySku).forEach(function(sku){
          let remaining = dupBySku[sku];
          poLineNums.forEach(function(rn){
            if(remaining<=0) return;
            if(String(liRows[rn-1][1]).trim()!==sku) return;
            const recv = Number(liRows[rn-1][8]||0);
            const cut  = Math.min(recv, remaining);
            const newRecv = recv - cut;
            const ordered = Number(liRows[rn-1][4]||0);
            liSheet.getRange(rn,9).setValue(newRecv);
            liSheet.getRange(rn,10).setValue(Math.max(0, ordered-newRecv));
            liSheet.getRange(rn,11).setValue((ordered-newRecv)<=0 && newRecv>0 ? 'Received' : (newRecv>0?'Partial':'Pending'));
            remaining -= cut;
          });
        });
        SpreadsheetApp.flush();

        // 2) Recompute PO status from the updated lines
        const updatedLi = liSheet.getDataRange().getValues().slice(1).filter(function(r){return String(r[0])===data.poNumber;});
        const allFulfilled = updatedLi.every(function(r){ return (r[9]===''||r[9]==null?0:Number(r[9]))<=0; });
        const anyReceived  = updatedLi.some(function(r){ return Number(r[8]||0)>0; });
        const newStatus = allFulfilled && anyReceived ? 'RECEIVED' : anyReceived ? 'PARTIAL' : 'APPROVED';
        poSheet.getRange(poIdx+1,4).setValue(newStatus);

        // 3) Subtract phantom stock (append correction row per SKU)
        Object.keys(dupBySku).forEach(function(sku){
          const cur = latest[sku]; if(!cur) return;
          cs.appendRow([ now, 'Reversal — duplicate PO receipt ('+(data.by||'admin')+')', 'Correction',
            sku, cur.name||sku, cur.qty - dupBySku[sku], cur.unit||'bag', data.poType||'DIST', cur.cat||'' ]);
        });

        // 4) Rewrite receipt history without the duplicate entries
        const kept = entries.filter(function(e,i){ return keep[i]; }).map(function(e){ return e.raw; });
        poSheet.getRange(poIdx+1,27).setValue(kept.join('|||'));

        return ok({ reversed:true, removedCount:removedCount, newStatus:newStatus,
          plan:plan, unmapped:unmapped });
      } finally { rlock.releaseLock(); }
    }


    // ── CREATE TRANSFER ───────────────────────────────────────────────
    if (data.action === 'createTransfer') {
      const hdrSheet = getOrCreateSheet(ss, 'Transfer Log', [
        'Transfer No','From Location','To Location','Via','Status',
        'Created By','Created Date','Received By','Received Date',
        'SKU Code','Item Name','Qty Dispatched','Qty Received',
        'Discrepancy','Unit','Notes'
      ]);
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      (data.lineItems||[]).forEach(li => {
        hdrSheet.appendRow([
          data.trfNumber, data.fromLocation, data.toLocation, data.via,
          data.status || 'IN TRANSIT',
          data.createdBy, now, '', '',
          li[1], li[2], li[3], 0, li[3],
          li[4] || 'bag', data.notes || ''
        ]);
      });
      return ok({ trfNumber: data.trfNumber });
    }

    // ── GET TRANSFERS ─────────────────────────────────────────────────
    if (data.action === 'getTransfers') {
      const sheet = ss.getSheetByName('Transfer Log');
      if (!sheet) return ok({ transfers: [] }); // Sheet auto-created on first transfer submit
      const rows = sheet.getDataRange().getValues();
      // Group rows by Transfer No (one row per line item in sheet)
      const map = {};
      rows.slice(1).filter(r=>r[0]).forEach(r => {
        const num = String(r[0]);
        if (!map[num]) {
          map[num] = {
            trfNumber:    num,
            fromLocation: String(r[1]),
            toLocation:   String(r[2]),
            via:          String(r[3]),
            status:       String(r[4]),
            createdBy:    String(r[5]),
            createdDate:  r[6] instanceof Date ? Utilities.formatDate(r[6], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(r[6]||''),
            receivedBy:   String(r[7]||''),
            receivedDate: r[8] instanceof Date ? Utilities.formatDate(r[8], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(r[8]||''),
            notes:        String(r[15]||''),
            lineCount:    0
          };
        }
        map[num].lineCount++;
      });
      const transfers = Object.values(map)
        .sort((a,b)=>new Date(b.createdDate)-new Date(a.createdDate));
      return ok({ transfers });
    }

    // ── GET TRANSFER DETAIL ───────────────────────────────────────────
    if (data.action === 'getTransferDetail') {
      const sheet = ss.getSheetByName('Transfer Log');
      if (!sheet) return err('No transfers found yet — create a transfer first');
      const rows = sheet.getDataRange().getValues();
      const trfRows = rows.slice(1).filter(r=>String(r[0])===data.trfNumber);
      if (!trfRows.length) return err('Transfer not found: '+data.trfNumber);
      const first = trfRows[0];
      const transfer = {
        trfNumber:    String(first[0]),
        fromLocation: String(first[1]),
        toLocation:   String(first[2]),
        via:          String(first[3]),
        status:       String(first[4]),
        createdBy:    String(first[5]),
        createdDate:  first[6] instanceof Date ? Utilities.formatDate(first[6], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(first[6]||''),
        receivedBy:   String(first[7]||''),
        notes:        String(first[15]||'')
      };
      const lineItems = trfRows.map((r,i) => ({
        lineIndex:     i,
        skuCode:       String(r[9]),
        itemName:      String(r[10]),
        qtyDispatched: Number(r[11]||0),
        qtyOrdered:    Number(r[11]||0),
        qtyReceived:   Number(r[12]||0),
        unit:          String(r[14]||'bag')
      }));
      return ok({ transfer, lineItems });
    }

    // ── ACKNOWLEDGE TRANSFER ──────────────────────────────────────────
    if (data.action === 'acknowledgeTransfer') {
      const sheet = getOrCreateSheet(ss, 'Transfer Log', [
        'Transfer No','From Location','To Location','Via','Status',
        'Created By','Created Date','Received By','Received Date',
        'SKU Code','Item Name','Qty Dispatched','Qty Received',
        'Discrepancy','Unit','Notes'
      ]);
      const rows = sheet.getDataRange().getValues();
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      let allReceived = true;

      // Update each line item's received qty — also mirror updates into rows[] so
      // the fullyDone check below sees the new values, not the pre-write snapshot
      (data.receipts||[]).forEach(receipt => {
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === data.trfNumber &&
              String(rows[i][9]) === String(receipt.skuCode)) {
            const newRec = Number(rows[i][12]||0) + Number(receipt.qtyReceived);
            const dispatched = Number(rows[i][11]||0);
            sheet.getRange(i+1, 13).setValue(newRec);
            sheet.getRange(i+1, 14).setValue(dispatched - newRec);
            sheet.getRange(i+1, 8).setValue(data.receivedBy);
            sheet.getRange(i+1, 9).setValue(now);
            rows[i][12] = newRec;           // keep in-memory copy in sync
            rows[i][13] = dispatched - newRec;
            if (newRec < dispatched) allReceived = false;
            break;
          }
        }
      });

      // Now rows[] reflects the updated values — this check is accurate
      const allLines = rows.slice(1).filter(r=>String(r[0])===data.trfNumber);
      const fullyDone = allLines.every(r=>Number(r[12]||0)>=Number(r[11]||0));
      const newStatus = fullyDone ? 'RECEIVED' : 'PARTIAL';

      // Update status on all rows for this transfer
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === data.trfNumber) {
          sheet.getRange(i+1, 5).setValue(newStatus);
        }
      }

      // ── INVENTORY UPDATE: only happens on acknowledgment ──
      const fromLoc = data.fromLocation;
      const toLoc   = data.toLocation;

      // Determine which stock count sheets to write to
      function getCountSheetName(location) {
        if (location === 'Retail Store') return 'Stock Counts - Retail';
        return 'Stock Counts - Distribution'; // WH, Bajaj1, Bajaj2
      }

      const fromSheetName = getCountSheetName(fromLoc);
      const toSheetName   = getCountSheetName(toLoc);
      const fromSheet = getOrCreateSheet(ss, fromSheetName, [
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category']);
      const toSheet   = getOrCreateSheet(ss, toSheetName, [
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category']);

      // "Qty On Hand" is an absolute balance (last row per SKU wins everywhere),
      // so read the latest balance per sheet and write new absolute totals —
      // never signed deltas. One shared map per sheet so chained writes stack,
      // including same-sheet transfers (e.g. WH → Bajaj1, both on Distribution).
      function buildLatestMap(sheet){
        const m = {};
        sheet.getDataRange().getValues().slice(1).forEach(function(r){
          if(!r[0]||!r[3]) return;
          m[String(r[3]).trim()] = Number(r[5])||0;
        });
        return m;
      }
      const latestBySheet = {};
      latestBySheet[fromSheetName] = buildLatestMap(fromSheet);
      if(toSheetName !== fromSheetName) latestBySheet[toSheetName] = buildLatestMap(toSheet);

      (data.receipts||[]).forEach(r => {
        const sku = String(r.skuCode).trim();
        // Deduct from source
        const fromMap = latestBySheet[fromSheetName];
        const fromNew = (fromMap[sku]||0) - Number(r.qtyReceived);
        fromSheet.appendRow([now, data.receivedBy, fromLoc,
          r.skuCode, r.itemName, fromNew,
          r.unit||'bag', 'TRANSFER', 'Transfer Out']);
        fromMap[sku] = fromNew;
        // Add to destination
        const toMap = latestBySheet[toSheetName];
        const toNew = (toMap[sku]||0) + Number(r.qtyReceived);
        toSheet.appendRow([now, data.receivedBy, toLoc,
          r.skuCode, r.itemName, toNew,
          r.unit||'bag', 'TRANSFER', 'Transfer In']);
        toMap[sku] = toNew;
      });

      return ok({ newStatus, toLocation: toLoc });
    }



    // ── GET PRODUCT LIST (prices + latest stock counts) ──────────────
    if (data.action === 'getProductList') {
      const distSkuSheet   = ss.getSheetByName('SKU Master');
      const retailSkuSheet = ss.getSheetByName('SKU Master - Retail');
      const distCntSheet   = ss.getSheetByName('Stock Counts - Distribution');
      const retailCntSheet = ss.getSheetByName('Stock Counts - Retail');

      // ── Build latest stock map per SKU from Stock Counts sheets ──
      // Stock Counts cols: Timestamp(0) SubmittedBy(1) Location(2) SKUCode(3)
      //                    ItemName(4) QtyOnHand(5) Unit(6) Type(7) Category(8)
      // Last row per SKU wins. The Stock Counts sheets are append-only and every
      // writer (receipts, transfers, production, adjustments, imports) chains new
      // ABSOLUTE balances onto the end — the rest of the app already reads them
      // that way. The old timestamp comparison here was slower (two Date parses
      // per row across a sheet that grows daily) and subtly wrong for batched
      // writes sharing one timestamp: `ts > lastUpdated` kept the FIRST row of a
      // batch while the correct current balance is the LAST.
      function buildStockMap(sheet) {
        const map = {}; // {skuCode: {stock, lastUpdated, unit}}
        if (!sheet) return map;
        sheet.getDataRange().getValues().slice(1).forEach(function(r){
          if (!r[0] || !r[3]) return;
          map[String(r[3]).trim()] = {
            stock: Number(r[5]) || 0,
            rawTs: r[0],
            unit:  String(r[6]||'units')
          };
        });
        // Normalise the timestamp once per SKU (not once per row)
        Object.keys(map).forEach(function(code){
          var v = map[code].rawTs, tsF;
          if (v instanceof Date) {
            tsF = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
          } else {
            var d = new Date(String(v));
            tsF = isNaN(d.getTime())
              ? String(v)
              : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
          }
          map[code].lastUpdated = tsF;
          delete map[code].rawTs;
        });
        return map;
      }

      const distStock   = buildStockMap(distCntSheet);
      const retailStock = buildStockMap(retailCntSheet);

      // ── Build distribution product list ──
      const includeInactive = data.includeInactive === true;
      const dist = [];
      if (distSkuSheet) {
        // Cols: A-Code B-Name C-Cat D-Type E-Order F-Active G-Notes
        //       H-Supplier I-Cost J-SellingPrice K-ParLevel
        distSkuSheet.getDataRange().getValues().slice(4)
          .filter(r=>r[0]&&(includeInactive||String(r[5]).toUpperCase()==='YES'))
          .forEach(r=>{
            const code = String(r[0]).trim();
            const stk  = distStock[code];
            dist.push({
              sku:         code,
              name:        String(r[1]).trim(),
              category:    String(r[2]).trim(),
              unit:        'bag',
              price:       Number(r[9])  || 0,
              parLevel:    Number(r[10]) || 0,
              bundleQty:   Number(r[11]) || 1,
              stock:       stk ? stk.stock       : null,
              lastUpdated: stk ? stk.lastUpdated : null
            });
          });
      }

      // ── Build retail product list ──
      const retail = [];
      if (retailSkuSheet) {
        // Cols: A-Code B-Name C-Cat D-Type E-Unit F-Revenue G-Order
        //       H-Active I-Supplier J-Cost K-SellingPrice
        //       L-IsProductionItem M-DisassemblyUOM N-AssemblyUOM O-StandardRatio P-ParLevel
        retailSkuSheet.getDataRange().getValues().slice(4)
          .filter(r=>r[0]&&(includeInactive||String(r[7]).toUpperCase()==='YES'))
          .forEach(r=>{
            const code = String(r[0]).trim();
            const stk  = retailStock[code];
            retail.push({
              sku:         code,
              name:        String(r[1]).trim(),
              category:    String(r[2]).trim(),
              unit:        String(r[4]||'pc').trim(),
              price:       Number(r[10]) || 0,
              parLevel:    Number(r[15]) || 0,
              bundleQty:   Number(r[16]) || 1,
              stock:       stk ? stk.stock       : null,
              lastUpdated: stk ? stk.lastUpdated : null
            });
          });
      }

      return ok({ dist, retail });
    }


    // ── UPDATE COST PRICES ────────────────────────────────────────────
    if (data.action === 'updateCostPrices') {
      const sheetName = data.type === 'retail'
        ? 'SKU Master - Retail'
        : 'SKU Master';
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return err(sheetName + ' sheet not found');

      const rows = sheet.getDataRange().getValues();
      // Cost Price column:
      // Distribution SKU Master → col I (index 8)
      // Retail SKU Master       → col J (index 9)
      const costCol = data.type === 'retail' ? 10 : 9;
      let updated = 0;

      for (let i = 1; i < rows.length; i++) {
        const code = String(rows[i][0]).trim();
        if (!code) continue;
        if (data.edits.hasOwnProperty(code)) {
          sheet.getRange(i+1, costCol).setValue(Number(data.edits[code]) || 0);
          updated++;
        }
      }
      return ok({ updated });
    }

    // ── DECLINE TRANSFER (receiving staff refuses) ────────────────────
    if (data.action === 'declineTransfer') {
      const sheet = ss.getSheetByName('Transfer Log');
      if (!sheet) return err('Transfer Log not found');
      const rows = sheet.getDataRange().getValues();
      const now  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === data.trfNumber) {
          sheet.getRange(i+1, 5).setValue('DECLINED');
          sheet.getRange(i+1, 8).setValue(data.declinedBy);
          sheet.getRange(i+1, 9).setValue(now);
          const existing = String(rows[i][15]||'');
          sheet.getRange(i+1, 16).setValue(
            (existing?existing+' | ':'') + 'Declined: ' + (data.reason||'')
          );
        }
      }
      return ok({ trfNumber: data.trfNumber });
    }

    // ── CANCEL TRANSFER (creator/admin cancels) ───────────────────────
    if (data.action === 'cancelTransfer') {
      const sheet = ss.getSheetByName('Transfer Log');
      if (!sheet) return err('Transfer Log not found');
      const rows = sheet.getDataRange().getValues();
      const now  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === data.trfNumber) {
          sheet.getRange(i+1, 5).setValue('CANCELLED');
          sheet.getRange(i+1, 8).setValue(data.cancelledBy);
          sheet.getRange(i+1, 9).setValue(now);
          const existing = String(rows[i][15]||'');
          sheet.getRange(i+1, 16).setValue(
            (existing?existing+' | ':'') + 'Cancelled by: ' + data.cancelledBy +
            (data.reason ? ' — ' + data.reason : '')
          );
        }
      }
      return ok({ trfNumber: data.trfNumber });
    }


    // ── STOCK ADJUSTMENT ──────────────────────────────────────────────
    if (data.action === 'submitStockAdjustment') {
      const segment  = data.segment || 'dist';
      const adjType  = data.adjType || 'receive';
      const now      = data.timestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const user     = data.submittedBy || '';
      const notes    = data.notes || '';
      const batchRef = data.batchRef || '';

      // ── Stock Adjustments log sheet ──
      const logSheet = getOrCreateSheet(ss, 'Stock Adjustments', [
        'Batch Ref','Timestamp','Submitted By','Segment','Adj Type',
        'SKU Code','Item Name','Stock Before','Qty Input','Adj Qty',
        'Stock After','Cost (₱)','Notes'
      ]);

      // ── Stock Counts target sheet ──
      const csName = segment==='retail'
        ? 'Stock Counts - Retail'
        : 'Stock Counts - Distribution';
      const csType = segment==='retail' ? 'RETAIL' : 'DIST';
      const csSheet = getOrCreateSheet(ss, csName, [
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category'
      ]);

      // Read the CURRENT balance per SKU server-side (last row per SKU = absolute
      // on-hand). The client's view may be stale, and the previous code wrote the
      // signed delta into "Qty On Hand" — which every reader treats as an absolute
      // balance, silently corrupting stock (e.g. 100 + receive 5 became "5 on hand").
      const adjLatest = {};
      csSheet.getDataRange().getValues().slice(1).forEach(function(r){
        if(!r[0] || !r[3]) return;
        const sku = String(r[3]).trim();
        adjLatest[sku] = {qty:Number(r[5])||0, unit:String(r[6]||'unit'), category:String(r[8]||'')};
      });

      (data.entries||[]).forEach(e => {
        const sku  = String(e.skuCode).trim();
        const cur  = adjLatest[sku] ? adjLatest[sku].qty : 0;
        const qty  = Number(e.qtyInput) || 0;
        let newQty;
        if (adjType === 'receive')      newQty = cur + qty;
        else if (adjType === 'count')   newQty = qty;            // counted = new absolute
        else                            newQty = Math.max(0, cur - qty); // remove / damage

        // Log entry — server-computed before/after so the audit trail is accurate
        logSheet.appendRow([
          batchRef, now, user,
          segment.toUpperCase(), adjType.toUpperCase(),
          e.skuCode, e.skuName,
          cur, qty,
          newQty - cur, newQty,
          e.cost || 0, notes
        ]);

        // Stock count entry — absolute new balance (last row per SKU wins)
        const location = adjType.toUpperCase() + ' ADJUSTMENT';
        const unit = adjLatest[sku] ? adjLatest[sku].unit : 'unit';
        csSheet.appendRow([
          now, user, location,
          e.skuCode, e.skuName,
          newQty,
          unit, csType, adjType.toUpperCase()
        ]);
        // Chain within the batch so two lines for the same SKU stack correctly
        adjLatest[sku] = {qty:newQty, unit:unit, category:adjLatest[sku]?adjLatest[sku].category:''};
      });

      return ok({ adjusted: (data.entries||[]).length });
    }

    // ── IMPORT XERO SALES ─────────────────────────────────────────────
    // Upsert by invoice: re-uploading a corrected/completed export REPLACES the
    // existing rows of any invoice it contains (it does not stack on top of the
    // old upload). Inventory is adjusted by the NET difference only, so a re-upload
    // ── WHAT WOULD THIS UPLOAD OVERWRITE? ─────────────────────────────
    // Read-only look-ahead for the import preview: which of the invoices in the
    // pending file are already on the sheet, and which upload put them there.
    // Writes nothing, so it is safe to call every time a file is picked.
    if (data.action === 'checkXeroOverlap') {
      const sheet = ss.getSheetByName('Sales Log - Distribution');
      const want = {};
      (data.invoiceNumbers || []).forEach(function(n){
        const s = String(n||'').trim(); if (s) want[s] = true;
      });
      if (!sheet || !Object.keys(want).length) {
        return ok({ existing: [], newInvoices: Object.keys(want) });
      }
      const rows = sheet.getDataRange().getValues();
      const hit = {};                       // invoice → {file, importedAt, lines}
      for (let i = 1; i < rows.length; i++) {
        const inv = String(rows[i][0]||'').trim();
        if (!inv || !want[inv]) continue;
        if (!hit[inv]) hit[inv] = {
          invoice: inv,
          file:       String(rows[i][18]||'').trim(),
          importedAt: String(rows[i][13]||'').trim(),
          lines: 0
        };
        hit[inv].lines++;
      }
      const existing = Object.keys(hit).map(function(k){ return hit[k]; });
      const newInvoices = Object.keys(want).filter(function(n){ return !hit[n]; });
      // Collapse to one entry per source file for display
      const byFile = {};
      existing.forEach(function(e){
        const f = e.file || '(file name not recorded)';
        if (!byFile[f]) byFile[f] = { file: f, importedAt: e.importedAt, invoices: [], lines: 0 };
        byFile[f].invoices.push(e.invoice);
        byFile[f].lines += e.lines;
      });
      return ok({
        existing: existing,
        newInvoices: newInvoices,
        byFile: Object.keys(byFile).map(function(f){ return byFile[f]; })
      });
    }

    // never double-deducts stock — edited quantities flow through as a delta.
    if (data.action === 'importXeroSales') {
      const xlock = LockService.getScriptLock();
      xlock.waitLock(20000);
      try {
        const sheet = getOrCreateSheet(ss, 'Sales Log - Distribution', [
          'Invoice Number','Invoice Date','Due Date','Dealer',
          'SKU Code','Description','Qty','Unit Price (₱)','Line Amount (₱)',
          'Invoice Total (₱)','Amount Paid (₱)','Amount Due (₱)',
          'Status','Imported At','Imported By','Division','Stock Mode','Location','Source File'
        ]);
        if (sheet.getRange(1,16).getValue() === '') sheet.getRange(1,16).setValue('Division');
        // Backfill the Stock Mode header on sheets created before this column
        if (sheet.getRange(1,17).getValue() === '') sheet.getRange(1,17).setValue('Stock Mode');
        // Location = the Xero tracking category saying which stock point the
        // line was sold from (Warehouse / Retail Store). Backfilled the same way
        // so sheets created before this column pick it up without a migration.
        if (sheet.getRange(1,18).getValue() === '') sheet.getRange(1,18).setValue('Location');
        // Which upload a row came from, so a replacement can name the file it
        // is displacing instead of reporting a bare count.
        if (sheet.getRange(1,19).getValue() === '') sheet.getRange(1,19).setValue('Source File');

        const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

        // 'warehouse' = direct pickup, deducts warehouse stock now.
        // 'load' (default) = builds the load list only; stock deducts when the van
        // is physically loaded. This is what stops the Xero-vs-Load double-count.
        const deduct = String(data.stockMode||'load').toLowerCase() === 'warehouse';
        const modeVal = deduct ? 'warehouse' : 'load';

        // Invoices present in THIS upload — their old rows get replaced.
        const uploadInvoices = {};
        (data.rows || []).forEach(function(r){
          const inv = String(r.invoiceNumber||'').trim();
          if (inv) uploadInvoices[inv] = true;
        });

        // Read existing rows. Keep the ones NOT being replaced; tally the OLD
        // quantities of the replaced invoices for the inventory net-delta.
        const all = sheet.getDataRange().getValues();
        const width = Math.max(19, (all[0]||[]).length);   // 19th col = Source File
        const kept = [];
        const oldQtyBySku = {};
        const replacedInv = {};
        const replacedFiles = {};   // sourceFile → { invoices:{}, importedAt }
        for (let i = 1; i < all.length; i++) {
          const inv = String(all[i][0]||'').trim();
          if (!inv) continue;
          if (uploadInvoices[inv]) {
            replacedInv[inv] = true;
            // Remember which upload these displaced rows came from. Replacement
            // is per invoice, so the overwritten lines may span several files.
            const srcF = String(all[i][18]||'').trim();
            const srcAt = String(all[i][13]||'').trim();
            if (!replacedFiles[srcF || '(file name not recorded)']) {
              replacedFiles[srcF || '(file name not recorded)'] = { invoices: {}, importedAt: srcAt };
            }
            replacedFiles[srcF || '(file name not recorded)'].invoices[inv] = true;
            const sku = String(all[i][4]||'').trim();
            // Only rows that ACTUALLY deducted before (stored mode 'warehouse')
            // count toward the reversal delta — so re-uploading a previously
            // warehouse-deducted invoice as 'load' correctly adds the stock back.
            // Legacy/blank/'load' rows are treated as never-deducted here.
            const prevMode = String(all[i][16]||'').toLowerCase();
            if (sku && prevMode === 'warehouse') {
              oldQtyBySku[sku] = (oldQtyBySku[sku]||0) + (Number(all[i][6])||0);
            }
          } else {
            const row = all[i].slice(0, width);
            while (row.length < width) row.push('');
            kept.push(row);
          }
        }

        // Normalise DD/MM/YYYY → ISO before writing. Sheets auto-parses slash
        // dates with the US convention (MM/DD), so "04/07/2026" became April 7 —
        // filing day-1-to-12 invoices under the wrong month. ISO is unambiguous.
        function xISO(s){
          s = String(s||'').trim();
          var dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          return dm ? (dm[3]+'-'+('0'+dm[2]).slice(-2)+'-'+('0'+dm[1]).slice(-2)) : s;
        }

        // Build the upload's new rows + tally new quantities per SKU.
        // New quantities only count toward a deduction when this upload is a
        // warehouse sale; a 'load' upload records the sale but never touches stock.
        const newQtyBySku = {}, itemBySku = {};
        const newRows = (data.rows || []).map(function(r){
          const sku = String(r.skuCode||'').trim();
          if (sku) {
            if (deduct) newQtyBySku[sku] = (newQtyBySku[sku]||0) + (Number(r.quantity)||0);
            if (!itemBySku[sku]) itemBySku[sku] = String(r.description||'');
          }
          const row = [r.invoiceNumber, xISO(r.invoiceDate), xISO(r.dueDate), r.contactName,
            r.skuCode, r.description, r.quantity, r.unitAmount, r.lineAmount,
            r.invoiceTotal, r.amountPaid, r.amountDue,
            r.status, now, data.importedBy||'', r.division||'', modeVal, r.location||'',
            String(data.fileName||'')];
          while (row.length < width) row.push('');
          return row;
        });

        // Rewrite the data area in one shot (fast + atomic): clear, then write
        // the kept rows followed by the upload's rows.
        const finalRows = kept.concat(newRows);
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, width).clearContent();
        if (finalRows.length) sheet.getRange(2, 1, finalRows.length, width).setValues(finalRows);

        // ── Inventory net delta per SKU: (new − old) = extra units sold ──
        const distCntSheet = getOrCreateSheet(ss, 'Stock Counts - Distribution', [
          'Timestamp','Submitted By','Location','SKU Code',
          'Item Name','Qty On Hand','Unit','Type','Category'
        ]);
        const distLatest = {};
        distCntSheet.getDataRange().getValues().slice(1)
          .filter(function(r){ return r[0] && r[3]; })
          .forEach(function(r){ distLatest[String(r[3]).trim()] = { qty:Number(r[5])||0, unit:String(r[6]||'bag'), category:String(r[8]||'') }; });

        const touched = {};
        Object.keys(newQtyBySku).forEach(function(s){ touched[s]=true; });
        Object.keys(oldQtyBySku).forEach(function(s){ touched[s]=true; });
        // Collect delta rows, then write once — appendRow per SKU made big
        // warehouse-mode imports crawl (each call is a full Sheets round trip)
        const deltaRows = [];
        Object.keys(touched).forEach(function(sku){
          const delta = (newQtyBySku[sku]||0) - (oldQtyBySku[sku]||0); // + = more sold, − = sold less
          if (delta === 0) return;
          if (!distLatest.hasOwnProperty(sku)) return; // no baseline — skip
          const cur = distLatest[sku];
          // NOTE: label is 'Xero Warehouse Sale' — deliberately NOT 'Xero Import'.
          // The old buggy always-deduct rows are labelled 'Xero Import', which is
          // what the one-time reversal tool targets. Keeping a distinct label here
          // means legitimate warehouse-sale deductions are never swept up by it.
          deltaRows.push([
            now, 'Xero Warehouse Sale (' + (data.importedBy||'system') + ')', 'Warehouse',
            sku, itemBySku[sku] || '', cur.qty - delta, cur.unit, 'DIST', cur.category
          ]);
        });
        let stockUpdated = deltaRows.length;
        if (deltaRows.length) {
          distCntSheet.getRange(distCntSheet.getLastRow()+1, 1, deltaRows.length, 9).setValues(deltaRows);
        }

        return ok({ imported: newRows.length, replaced: Object.keys(replacedInv).length,
          stockUpdated: stockUpdated, mode: modeVal,
          fileName: String(data.fileName||''),
          replacedFrom: Object.keys(replacedFiles).map(function(f){
            return { file: f, importedAt: replacedFiles[f].importedAt,
                     invoices: Object.keys(replacedFiles[f].invoices) };
          }) });
      } finally {
        xlock.releaseLock();
      }
    }

    // ── XERO DEDUCTION REVERSAL (one-time cleanup of the double-deduct bug) ──
    // Old 'Xero Import' rows in Stock Counts - Distribution deducted warehouse
    // stock that the LOAD movement also deducted — the same bags twice. This
    // reverses those rows: per SKU it sums how much the un-reversed 'Xero Import'
    // rows removed (optionally within a date range and only for selected SKUs),
    // appends one correction entry restoring the right on-hand, then tags the
    // reversed rows so a repeat run is a no-op (idempotent). Legitimate
    // 'Xero Warehouse Sale' rows are never touched.
    if (data.action === 'previewXeroReversal' || data.action === 'applyXeroReversal') {
      const apply = data.action === 'applyXeroReversal';
      if (apply && String(data.role||'').toLowerCase() !== 'admin')
        return err('Admin only — reversal not permitted');
      const cs = ss.getSheetByName('Stock Counts - Distribution');
      if (!cs) return ok({ items: [], totalBags: 0, applied: apply, skuCount: 0, minDate:'', maxDate:'' });

      const tz    = Session.getScriptTimeZone();
      const fromD = String(data.fromDate||'').trim();   // 'yyyy-MM-dd' or '' (no lower bound)
      const toD   = String(data.toDate||'').trim();     // 'yyyy-MM-dd' or '' (no upper bound)
      function rowDate(v){
        return (v instanceof Date) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v||'').slice(0,10);
      }
      function inRange(v){
        const d = rowDate(v);
        if (fromD && d < fromD) return false;
        if (toD   && d > toD)   return false;
        return true;
      }
      // Optional per-SKU selection (apply only). null = every affected SKU.
      let selSet = null;
      if (Array.isArray(data.skus)) { selSet = {}; data.skus.forEach(function(s){ selSet[String(s).trim()] = true; }); }

      const vals = cs.getDataRange().getValues();
      const bySku = {};
      let minDate = '', maxDate = '';
      for (let i = 1; i < vals.length; i++) {
        const r = vals[i];
        if (!r[0] || !r[3]) continue;
        const sku = String(r[3]).trim();
        const by  = String(r[1]||'');
        const isXero = by.indexOf('Xero Import') === 0 && by.indexOf('[REVERSED]') < 0;
        if (isXero) {  // track the span of reversible rows so the UI can bound its date pickers
          const d = rowDate(r[0]);
          if (d && (!minDate || d < minDate)) minDate = d;
          if (d && (!maxDate || d > maxDate)) maxDate = d;
        }
        (bySku[sku] = bySku[sku] || []).push({
          rowNum: i+1, value: Number(r[5])||0, isXero: isXero, ts: r[0],
          item: String(r[4]||''), unit: String(r[6]||'bag'), cat: String(r[8]||'')
        });
      }

      const now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
      const items = []; let totalBags = 0; let tagRows = [];
      Object.keys(bySku).forEach(function(sku){
        // On apply with a selection, skip SKUs the user didn't tick
        if (apply && selSet && !selSet[sku]) return;
        const chain = bySku[sku];
        let prev = null, deducted = 0; const xeroRowNums = [];
        chain.forEach(function(e){
          // A row's change = previous on-hand − this on-hand. Count only the
          // un-reversed Xero rows within the date range; the chain still walks
          // real stored values so interleaved Load/Count rows keep maths correct.
          const countIt = (prev !== null) && e.isXero && inRange(e.ts);
          if (countIt) { deducted += (prev - e.value); xeroRowNums.push(e.rowNum); }
          prev = e.value;
        });
        if (deducted === 0 || !xeroRowNums.length) return;
        const last = chain[chain.length-1];
        const corrected = last.value + deducted;   // only adds back what's being reversed
        items.push({ sku: sku, item: last.item, current: last.value,
          deducted: deducted, corrected: corrected, rows: xeroRowNums.length });
        totalBags += deducted;
        tagRows = tagRows.concat(xeroRowNums);
        if (apply) {
          cs.appendRow([
            now, 'Reversal — Xero double-deduction (' + (data.by||'admin') + ')', 'Correction',
            sku, last.item, corrected, last.unit, 'DIST', last.cat
          ]);
        }
      });

      if (apply && tagRows.length) {
        SpreadsheetApp.flush();
        // Tag reversed rows so a second run reverses nothing (idempotent)
        tagRows.forEach(function(rn){
          const cell = cs.getRange(rn, 2);
          const cur  = String(cell.getValue()||'');
          if (cur.indexOf('[REVERSED]') < 0) cell.setValue(cur + ' [REVERSED]');
        });
      }
      return ok({ items: items, totalBags: totalBags, applied: apply, skuCount: items.length,
        minDate: minDate, maxDate: maxDate });
    }

    // ── IMPORT LOYVERSE SALES ─────────────────────────────────────────
    if (data.action === 'importLoyverseSales') {
      const sheet = getOrCreateSheet(ss, 'Sales Log - Retail', [
        'Receipt No','Date','Time','Receipt Type','Category',
        'SKU','Item','Variant','Qty',
        'Gross Sales (₱)','Discounts (₱)','Net Sales (₱)',
        'Cost of Goods (₱)','Gross Profit (₱)','Taxes (₱)',
        'Cashier','Customer Name','Customer Contact','Store',
        'Status','Imported At','Imported By'
      ]);

      // Deduplicate by Receipt No + SKU + Variant
      const existing = new Set();
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        if (r[0] && r[5]) existing.add(String(r[0]).trim()+'|'+String(r[5]).trim()+'|'+String(r[7]).trim());
      });

      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      let imported = 0, skipped = 0;
      const importedRows = [];

      (data.rows || []).forEach(r => {
        const key = String(r.receiptNumber).trim()+'|'+String(r.sku).trim()+'|'+String(r.variant||'').trim();
        if (existing.has(key)) { skipped++; return; }
        sheet.appendRow([
          r.receiptNumber, r.date, r.time, r.receiptType, r.category,
          r.sku, r.item, r.variant||'',  r.qty,
          r.grossSales, r.discounts, r.netSales,
          r.cogs, r.grossProfit, r.taxes,
          r.cashier, r.customerName, r.customerContact, r.store,
          r.status, now, data.importedBy||''
        ]);
        existing.add(key);
        imported++;
        importedRows.push(r);
      });

      // ── Auto-deduct from Stock Counts - Retail ────────────────────
      // Build net qty map per SKU from newly imported rows only
      // r.qty is already signed (sales = positive, refunds = negative from parseLyCSV)
      const deductMap = {}; // sku → { netQty, item, category }
      importedRows.forEach(function(r) {
        const sku = String(r.sku).trim();
        if (!deductMap[sku]) deductMap[sku] = { netQty: 0, item: String(r.item||''), category: String(r.category||'') };
        deductMap[sku].netQty += Number(r.qty) || 0;
      });

      // Read current stock from Stock Counts - Retail
      // Cols: Timestamp(0) SubmittedBy(1) Location(2) SKUCode(3) ItemName(4) QtyOnHand(5) Unit(6) Type(7) Category(8)
      const cntSheet = getOrCreateSheet(ss, 'Stock Counts - Retail', [
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category'
      ]);
      const cntRows = cntSheet.getDataRange().getValues().slice(1)
        .filter(function(r) { return r[0] && r[3]; });

      // Find latest stock entry per SKU (last row wins since sheet is append-only)
      const latestStock = {};
      cntRows.forEach(function(r) {
        const sku = String(r[3]).trim();
        latestStock[sku] = { qty: Number(r[5]) || 0, unit: String(r[6] || ''), category: String(r[8] || '') };
      });

      // Append new stock count entries for affected SKUs
      let stockUpdated = 0;
      Object.keys(deductMap).forEach(function(sku) {
        const info = deductMap[sku];
        if (info.netQty === 0) return;                   // No net movement — skip
        if (!latestStock.hasOwnProperty(sku)) return;    // SKU not in stock counts — skip (no baseline)
        const current = latestStock[sku];
        const newQty  = current.qty - info.netQty;       // netQty positive = sales deduct stock
        cntSheet.appendRow([
          now,
          'Loyverse Import (' + (data.importedBy || 'system') + ')',
          'Retail Store',
          sku,
          info.item,
          newQty,
          current.unit,
          'RETAIL',
          current.category || info.category
        ]);
        stockUpdated++;
      });

      return ok({ imported, skipped, stockUpdated });
    }

    // ── GET LOYVERSE SALES ────────────────────────────────────────────
    if (data.action === 'getLoyverseSales') {
      const sheet = ss.getSheetByName('Sales Log - Retail');
      if (!sheet) return ok({ rows: [] });
      const rows = sheet.getDataRange().getValues().slice(1)
        .filter(r => r[0])
        .map(r => ({
          receiptNumber:   String(r[0]),
          date:            String(r[1]),
          time:            String(r[2]),
          receiptType:     String(r[3]),
          category:        String(r[4]),
          sku:             String(r[5]),
          item:            String(r[6]),
          variant:         String(r[7]),
          qty:             Number(r[8])  || 0,
          grossSales:      Number(r[9])  || 0,
          discounts:       Number(r[10]) || 0,
          netSales:        Number(r[11]) || 0,
          cogs:            Number(r[12]) || 0,
          grossProfit:     Number(r[13]) || 0,
          taxes:           Number(r[14]) || 0,
          cashier:         String(r[15]),
          customerName:    String(r[16]),
          customerContact: String(r[17]),
          store:           String(r[18]),
          status:          String(r[19]),
          importedAt:      String(r[20]),
          importedBy:      String(r[21])
        }));
      return ok({ rows });
    }

    // ── GET XERO SALES ────────────────────────────────────────────────
    if (data.action === 'getXeroSales') {
      const sheet = ss.getSheetByName('Sales Log - Distribution');
      if (!sheet) return ok({ rows: [] });
      const rows = sheet.getDataRange().getValues().slice(1)
        .filter(r => r[0])
        .map(r => ({
          invoiceNumber: String(r[0]),
          invoiceDate:   String(r[1]),
          dueDate:       String(r[2]),
          dealer:        String(r[3]),
          skuCode:       String(r[4]),
          description:   String(r[5]),
          qty:           Number(r[6])  || 0,
          unitPrice:     Number(r[7])  || 0,
          lineAmount:    Number(r[8])  || 0,
          invoiceTotal:  Number(r[9])  || 0,
          amountPaid:    Number(r[10]) || 0,
          amountDue:     Number(r[11]) || 0,
          status:        String(r[12]),
          importedAt:    String(r[13]),
          importedBy:    String(r[14])
        }));
      return ok({ rows });
    }

    // ── DEALER DIRECTORY ─────────────────────────────────────────────
    if (data.action === 'getDealers') {
      const sheet = getOrCreateSheet(ss, 'Dealer Directory', [
        'Dealer ID','Store Name','Owner Name','Phone 1','Phone 2',
        'Area','Address','Dealer Type','Status',
        'Latitude','Longitude','GPS Accuracy (m)',
        'Notes','Added By','Date Added','Updated By','Last Updated',
        'Assigned Vehicle'
      ]);
      const rows = sheet.getDataRange().getValues().slice(1)
        .filter(r => r[0])
        .map(r => ({
          dealerId:   String(r[0]),
          storeName:  String(r[1]),
          ownerName:  String(r[2]),
          phone1:     String(r[3]),
          phone2:     String(r[4]||''),
          area:       String(r[5]||''),
          address:    String(r[6]||''),
          dealerType: String(r[7]||''),
          status:     String(r[8]||'Prospect'),
          lat:        String(r[9]||''),
          lng:        String(r[10]||''),
          accuracy:   String(r[11]||''),
          notes:      String(r[12]||''),
          addedBy:    String(r[13]||''),
          addedAt:    r[14] instanceof Date
            ? Utilities.formatDate(r[14], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
            : String(r[14]||''),
          updatedBy:  String(r[15]||''),
          updatedAt:  r[16] instanceof Date
            ? Utilities.formatDate(r[16], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
            : String(r[16]||''),
          assignedVehicle: String(r[17]||'')
        }));
      return ok({ dealers: rows });
    }

    if (data.action === 'saveDealer') {
      const sheet = getOrCreateSheet(ss, 'Dealer Directory', [
        'Dealer ID','Store Name','Owner Name','Phone 1','Phone 2',
        'Area','Address','Dealer Type','Status',
        'Latitude','Longitude','GPS Accuracy (m)',
        'Notes','Added By','Date Added','Updated By','Last Updated',
        'Assigned Vehicle'
      ]);
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      // Generate Dealer ID: DLR-YYYYMMDD-NNN
      const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
      const existing = sheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]).includes(dateStr));
      const dealerId = 'DLR-' + dateStr + '-' + String(existing.length + 1).padStart(3,'0');
      sheet.appendRow([
        dealerId,
        data.storeName || '', data.ownerName || '',
        data.phone1 || '',    data.phone2 || '',
        data.area || '',      data.address || '',
        data.dealerType || '', data.status || 'Prospect',
        data.lat || '',       data.lng || '',  data.accuracy || '',
        data.notes || '',
        data.addedBy || '', now,
        '', '',
        data.assignedVehicle || ''
      ]);
      return ok({ dealerId });
    }

    if (data.action === 'updateDealer') {
      const sheet = ss.getSheetByName('Dealer Directory');
      if (!sheet) return err('Dealer Directory sheet not found');
      const now  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) !== data.dealerId) continue;
        sheet.getRange(i+1, 2).setValue(data.storeName  || '');
        sheet.getRange(i+1, 3).setValue(data.ownerName  || '');
        sheet.getRange(i+1, 4).setValue(data.phone1     || '');
        sheet.getRange(i+1, 5).setValue(data.phone2     || '');
        sheet.getRange(i+1, 6).setValue(data.area       || '');
        sheet.getRange(i+1, 7).setValue(data.address    || '');
        sheet.getRange(i+1, 8).setValue(data.dealerType || '');
        sheet.getRange(i+1, 9).setValue(data.status     || '');
        sheet.getRange(i+1,10).setValue(data.lat        || '');
        sheet.getRange(i+1,11).setValue(data.lng        || '');
        sheet.getRange(i+1,12).setValue(data.accuracy   || '');
        sheet.getRange(i+1,13).setValue(data.notes      || '');
        sheet.getRange(i+1,16).setValue(data.updatedBy  || '');
        sheet.getRange(i+1,17).setValue(now);
        if (data.assignedVehicle !== undefined)
          sheet.getRange(i+1,18).setValue(data.assignedVehicle || '');
        // Backfill the header if this sheet predates the Assigned Vehicle column
        if (sheet.getRange(1,18).getValue() === '')
          sheet.getRange(1,18).setValue('Assigned Vehicle');
        return ok({ dealerId: data.dealerId, updatedAt: now });
      }
      return err('Dealer not found: ' + data.dealerId);
    }

    if (data.action === 'deleteDealer') {
      const sheet = ss.getSheetByName('Dealer Directory');
      if (!sheet) return err('Dealer Directory sheet not found');
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][0]) === data.dealerId) {
          sheet.deleteRow(i + 1);
          return ok({ deleted: data.dealerId });
        }
      }
      return err('Dealer not found: ' + data.dealerId);
    }

    // ── DEALER DELETION REQUESTS ──────────────────────────────────────
    // Staff/drivers submit requests; admins approve or reject them.

    if (data.action === 'requestDealerDeletion') {
      const sheet = getOrCreateSheet(ss, 'Dealer Deletion Requests', [
        'Request ID','Dealer ID','Store Name','Requested By','Requested At',
        'Status','Resolved By','Resolved At'
      ]);
      const now   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const reqId = 'DELREQ-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
      sheet.appendRow([
        reqId,
        data.dealerId    || '',
        data.storeName   || '',
        data.requestedBy || '',
        now,
        'Pending',
        '',
        ''
      ]);
      return ok({ requestId: reqId });
    }

    if (data.action === 'getDealerDeletionRequests') {
      const sheet = ss.getSheetByName('Dealer Deletion Requests');
      if (!sheet) return ok({ requests: [] });
      const requests = sheet.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && String(r[5]) === 'Pending'; })
        .map(function(r){
          return {
            requestId:   String(r[0]),
            dealerId:    String(r[1]),
            storeName:   String(r[2]),
            requestedBy: String(r[3]),
            requestedAt: r[4] instanceof Date
              ? Utilities.formatDate(r[4], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
              : String(r[4] || '').slice(0, 16),
            status:      String(r[5])
          };
        });
      return ok({ requests: requests });
    }

    if (data.action === 'resolveDealerDeletion') {
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

      // 1. Update the request row status
      const reqSheet = ss.getSheetByName('Dealer Deletion Requests');
      if (reqSheet) {
        const reqRows = reqSheet.getDataRange().getValues();
        for (var ri = 1; ri < reqRows.length; ri++) {
          if (String(reqRows[ri][0]) === data.requestId) {
            reqSheet.getRange(ri + 1, 6).setValue(data.approve ? 'Approved' : 'Rejected');
            reqSheet.getRange(ri + 1, 7).setValue(data.resolvedBy || '');
            reqSheet.getRange(ri + 1, 8).setValue(now);
            break;
          }
        }
      }

      // 2. If approved, physically delete the dealer row
      if (data.approve) {
        const dlrSheet = ss.getSheetByName('Dealer Directory');
        if (dlrSheet) {
          const dlrRows = dlrSheet.getDataRange().getValues();
          for (var di = dlrRows.length - 1; di >= 1; di--) {
            if (String(dlrRows[di][0]) === data.dealerId) {
              dlrSheet.deleteRow(di + 1);
              break;
            }
          }
        }
      }

      return ok({ resolved: data.requestId, approved: !!data.approve });
    }

    // ── SKU ADD REQUESTS ──────────────────────────────────────────────
    // Staff submit item suggestions; admins approve (writes to SKU Master) or reject.

    if (data.action === 'submitSKURequest') {
      // Columns: A:RequestID B:Segment C:Category D:ItemName E:SKUCode
      //          F:Supplier G:CostPrice H:Notes I:RequestedBy J:RequestedAt K:Status
      //          L:ResolvedBy M:ResolvedAt N:Unit O:IsProd P:ProdType Q:RelatedSKU R:Ratio
      const sheet = getOrCreateSheet(ss, 'SKU Add Requests', [
        'Request ID','Segment','Category','Item Name','SKU Code',
        'Supplier','Cost Price','Notes','Requested By','Requested At',
        'Status','Resolved By','Resolved At',
        'Unit','Is Production Item','Prod Type','Related SKU','Standard Ratio'
      ]);
      const now   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const reqId = 'SKUREQ-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
      sheet.appendRow([
        reqId,
        data.segment     || 'DIST',  // B
        data.category    || '',       // C
        data.name        || '',       // D
        data.code        || '',       // E
        data.supplier    || '',       // F
        Number(data.cost) || 0,       // G: Cost Price
        data.notes       || '',       // H
        data.requestedBy || '',       // I
        now,                          // J
        'Pending', '', '',            // K L M
        data.unit        || '',       // N
        data.isProd      || 'NO',     // O
        data.prodType    || '',       // P
        data.relatedSku  || '',       // Q
        data.ratio       || ''        // R
      ]);
      return ok({ requestId: reqId });
    }

    if (data.action === 'getSKURequests') {
      const sheet = ss.getSheetByName('SKU Add Requests');
      if (!sheet) return ok({ requests: [] });
      const requests = sheet.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && String(r[10]) === 'Pending'; })
        .map(function(r){
          return {
            requestId:   String(r[0]),
            segment:     String(r[1]),
            category:    String(r[2]),
            name:        String(r[3]),
            code:        String(r[4]  || ''),
            supplier:    String(r[5]  || ''),
            cost:        r[6] || 0,
            notes:       String(r[7]  || ''),
            requestedBy: String(r[8]),
            requestedAt: r[9] instanceof Date
              ? Utilities.formatDate(r[9], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
              : String(r[9] || '').slice(0, 16),
            unit:        String(r[13] || ''),
            isProd:      String(r[14] || 'NO'),
            prodType:    String(r[15] || ''),
            relatedSku:  String(r[16] || ''),
            ratio:       String(r[17] || '')
          };
        });
      return ok({ requests: requests });
    }

    if (data.action === 'resolveSKURequest') {
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

      // Update request row status in SKU Add Requests sheet
      const reqSheet = ss.getSheetByName('SKU Add Requests');
      if (reqSheet) {
        const reqRows = reqSheet.getDataRange().getValues();
        for (var ri = 1; ri < reqRows.length; ri++) {
          if (String(reqRows[ri][0]) === data.requestId) {
            reqSheet.getRange(ri + 1, 11).setValue(data.approve ? 'Approved' : 'Rejected');
            reqSheet.getRange(ri + 1, 12).setValue(data.resolvedBy || '');
            reqSheet.getRange(ri + 1, 13).setValue(now);
            break;
          }
        }
      }

      // If approved, append to the appropriate SKU Master sheet
      if (data.approve) {
        const isProd = String(data.isProd || 'NO').toUpperCase() === 'YES';

        if (String(data.segment) === 'RETAIL') {
          // SKU Master - Retail:
          // A:Code B:Name C:Category D:Type E:Unit F:Rev G:Order H:Active
          // I:Supplier J:Cost K:SellingPrice
          // L:IsProductionItem M:DisassemblyUOM N:AssemblyUOM O:StandardRatio
          const rSheet = getOrCreateSheet(ss, 'SKU Master - Retail', [
            'Code','Name','Category','Type','Unit','Rev','Order',
            'Active','Supplier','Cost','Selling Price',
            'Is Production Item','Disassembly UOM','Assembly UOM','Standard Ratio'
          ]);
          const rRows = rSheet.getDataRange().getValues().slice(4).filter(function(r){ return r[0]; });
          const rMax  = rRows.reduce(function(m, r){ return Math.max(m, Number(r[6]) || 0); }, 1000);

          const disUOM = (isProd && String(data.prodType) === 'disassemble') ? (data.relatedSku || '') : '';
          const asmUOM = (isProd && String(data.prodType) === 'assemble')    ? (data.relatedSku || '') : '';

          rSheet.appendRow([
            data.code,              // A: Code
            data.name,              // B: Name
            data.category || '',    // C: Category
            '',                     // D: Type
            data.unit     || 'bag', // E: Unit
            '',                     // F: Rev
            rMax + 10,              // G: Order
            'YES',                  // H: Active
            data.supplier || '',          // I: Supplier
            Number(data.cost) || 0,       // J: Cost
            0,                            // K: Selling Price
            isProd ? 'YES' : 'NO',  // L: IsProductionItem
            disUOM,                 // M: DisassemblyUOM
            asmUOM,                 // N: AssemblyUOM
            isProd ? (Number(data.ratio) || 0) : '' // O: StandardRatio
          ]);

        } else {
          // SKU Master (DIST):
          // A:Code B:Name C:Category D:Description E:Order F:Active G:DisplayOrder H:Supplier I:Cost
          const dSheet = getOrCreateSheet(ss, 'SKU Master', [
            'Code','Name','Category','Description','Order','Active',
            'Display Order','Supplier','Cost'
          ]);
          const dRows = dSheet.getDataRange().getValues().slice(4).filter(function(r){ return r[0]; });
          const dMax  = dRows.reduce(function(m, r){ return Math.max(m, Number(r[4]) || 0); }, 100);
          dSheet.appendRow([
            data.code,           // A: Code
            data.name,           // B: Name
            data.category || '', // C: Category
            '',                  // D: Description
            dMax + 10,           // E: Order
            'YES',               // F: Active
            '',                  // G: Display Order
            data.supplier || '',       // H: Supplier
            Number(data.cost) || 0    // I: Cost
          ]);
        }
      }

      return ok({ resolved: data.requestId, approved: !!data.approve });
    }

    // ── SALES INVOICES ────────────────────────────────────────────────
    if (data.action === 'saveInvoice') {
      const invSheet  = getOrCreateSheet(ss, 'Sales Invoices', [
        'Invoice Number','Contact Name','Dealer ID','Reference',
        'Invoice Date','Due Date','Payment Terms','Subtotal','Total',
        'Status','Created By','Created At',
        'Payment Type','Check Reference','Received By','Signature'
      ]);
      const lineSheet = getOrCreateSheet(ss, 'Sales Invoice Lines', [
        'Invoice Number','Line #','SKU','Description',
        'Quantity','Unit Price','Discount %','Line Total'
      ]);

      // Generate invoice number: INV-YYYYMMDD-NNN
      // Lock so two simultaneous saves (e.g. two drivers in the field) can't read
      // the same max sequence and produce duplicate invoice numbers
      const invLock = LockService.getScriptLock();
      invLock.waitLock(10000);
      let invoiceNumber;
      try {
        const today  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
        const prefix = 'INV-' + today + '-';
        const allRows = invSheet.getDataRange().getValues();
        let maxSeq = 0;
        allRows.slice(1).forEach(function(r){
          if (String(r[0]).startsWith(prefix)){
            const seq = parseInt(String(r[0]).slice(prefix.length)) || 0;
            if (seq > maxSeq) maxSeq = seq;
          }
        });
        invoiceNumber = prefix + String(maxSeq + 1).padStart(3, '0');

        invSheet.appendRow([
          invoiceNumber,
          data.contactName  || '',
          data.dealerId     || '',
          data.reference    || '',
          data.invoiceDate  || '',
          data.dueDate      || '',
          data.paymentTerms || '',
          Number(data.subtotal) || 0,
          Number(data.total)    || 0,
          'Saved',
          data.createdBy    || '',
          data.createdAt    || '',
          data.paymentType  || 'Cash',
          data.checkRef     || '',
          data.receivedBy   || '',
          data.signature    || ''
        ]);
      } finally {
        invLock.releaseLock();
      }

      const lines = data.lines || [];
      lines.forEach(function(l, i){
        lineSheet.appendRow([
          invoiceNumber,
          i + 1,
          l.sku       || '',
          l.desc      || '',
          Number(l.qty)       || 0,
          Number(l.unitPrice) || 0,
          Number(l.discount)  || 0,
          Number(l.lineTotal) || 0
        ]);
      });

      // ── Desk sale (admin/warehouse staff): deduct from distribution stock ──
      // Drivers have a real van unit (Bajaj1/Bajaj2); admin and warehouse staff
      // have 'All' or blank — those sales come straight out of warehouse stock.
      // (Previously only checked for blank, so admin sales never deducted: dead code.)
      const _saleUnit = String(data.assignedUnit||'').trim();
      if(_saleUnit==='' || _saleUnit==='All'){
        const distCntSale = getOrCreateSheet(ss, 'Stock Counts - Distribution', [
          'Timestamp','Submitted By','Location','SKU Code',
          'Item Name','Qty On Hand','Unit','Type','Category'
        ]);
        // Build latest absolute stock per SKU
        const stkRows = distCntSale.getDataRange().getValues().slice(1).filter(function(r){return r[0]&&r[3];});
        const latestStkMap = {};
        stkRows.forEach(function(r){
          const sku = String(r[3]).trim();
          latestStkMap[sku] = {qty:Number(r[5])||0, unit:String(r[6]||'bag'), category:String(r[8]||'')};
        });
        const nowSale = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        lines.forEach(function(l){
          if(!l.sku||!l.qty) return;
          const sku = String(l.sku).trim();
          if(!latestStkMap.hasOwnProperty(sku)) return;
          const info   = latestStkMap[sku];
          const newQty = Math.max(0, info.qty - (Number(l.qty)||0));
          distCntSale.appendRow([
            nowSale, data.createdBy||'', 'Admin Sale - '+invoiceNumber,
            sku, String(l.desc||''), newQty, info.unit||'bag', 'DIST', info.category||''
          ]);
        });
      }

      return ok({ invoiceNumber: invoiceNumber });
    }

    if (data.action === 'getInvoices') {
      const invSheet = ss.getSheetByName('Sales Invoices');
      if (!invSheet) return ok({ invoices: [] });
      let rows = invSheet.getDataRange().getValues().slice(1).filter(r => r[0]);
      // Optional dealer filter
      if (data.dealerId) rows = rows.filter(r => String(r[2]) === String(data.dealerId));
      // Return newest first, cap at 200
      const invoices = rows.reverse().slice(0, 200).map(function(r){
        return {
          invoiceNumber: String(r[0]),
          contactName:   String(r[1]),
          dealerId:      String(r[2]),
          reference:     String(r[3]),
          invoiceDate:   r[4] instanceof Date
            ? Utilities.formatDate(r[4], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[4]),
          dueDate:       r[5] instanceof Date
            ? Utilities.formatDate(r[5], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[5]),
          paymentTerms:  String(r[6]),
          subtotal:      Number(r[7]) || 0,
          total:         Number(r[8]) || 0,
          status:        String(r[9]),
          createdBy:     String(r[10]),
          createdAt:     String(r[11]),
          paymentType:   String(r[12] || 'Cash'),
          checkRef:      String(r[13] || ''),
          receivedBy:    String(r[14] || '')
          // col 15 (P) = Signature — omitted from list (large base64)
        };
      });
      return ok({ invoices: invoices });
    }

    // ── VOID INVOICE (admin only) ─────────────────────────────────────────
    // ── INVOICE DETAIL — full record for review / reprint ──────────────
    if (data.action === 'getInvoiceDetail') {
      const invNum = String(data.invoiceNumber||'').trim();
      if (!invNum) return err('Invoice number required');
      const invSheet = ss.getSheetByName('Sales Invoices');
      if (!invSheet) return err('Sales Invoices sheet not found');
      const tzD = Session.getScriptTimeZone();
      const dOf = function(v){ return v instanceof Date
        ? Utilities.formatDate(v, tzD, 'yyyy-MM-dd') : String(v||'').slice(0,10); };

      let head = null;
      invSheet.getDataRange().getValues().slice(1).forEach(function(r){
        if (!r[0] || String(r[0]).trim() !== invNum) return;
        head = {
          invoiceNumber: String(r[0]), contactName: String(r[1]), dealerId: String(r[2]),
          reference: String(r[3]), invoiceDate: dOf(r[4]), dueDate: dOf(r[5]),
          paymentTerms: String(r[6]), subtotal: Number(r[7])||0, total: Number(r[8])||0,
          status: String(r[9]), createdBy: String(r[10]), createdAt: String(r[11]),
          paymentType: String(r[12]||'Cash'), checkRef: String(r[13]||''),
          signature: String(r[14]||''),
          voidReason: String(r[16]||''), voidedBy: String(r[17]||''), voidedAt: String(r[18]||'')
        };
      });
      if (!head) return err('Invoice not found: ' + invNum);

      // Line items: 0 InvoiceNo · 1 SKU · 2 Code · 3 Description · 4 Qty · 5 Price · 6 Disc · 7 LineTotal
      const lines = [];
      const lnSheet = ss.getSheetByName('Sales Invoice Lines');
      if (lnSheet) {
        lnSheet.getDataRange().getValues().slice(1).forEach(function(r){
          if (!r[0] || String(r[0]).trim() !== invNum) return;
          lines.push({ skuCode: String(r[2]||r[1]||''), description: String(r[3]||''),
            qty: Number(r[4])||0, unitPrice: Number(r[5])||0,
            discount: Number(r[6])||0, lineTotal: Number(r[7])||0 });
        });
      }

      // Dealer snapshot for the receipt header
      let dealer = null;
      const dirD = ss.getSheetByName('Dealer Directory');
      if (dirD) dirD.getDataRange().getValues().slice(1).forEach(function(r){
        if (String(r[0]) === head.dealerId) dealer = { storeName:String(r[1]||''),
          ownerName:String(r[2]||''), phone1:String(r[3]||''), phone2:String(r[4]||''),
          area:String(r[5]||''), address:String(r[6]||'') };
      });

      return ok({ invoice: head, lines: lines, dealer: dealer });
    }

    if (data.action === 'voidInvoice') {
      const invSheet = ss.getSheetByName('Sales Invoices');
      if (!invSheet) return err('Sales Invoices sheet not found');
      const invNum = String(data.invoiceNumber || '').trim();
      if (!invNum) return err('Invoice number required');
      const rows = invSheet.getDataRange().getValues();
      var targetRow = -1;
      for (var vi = 1; vi < rows.length; vi++) {
        if (String(rows[vi][0]).trim() === invNum) { targetRow = vi + 1; break; }
      }
      if (targetRow < 0) return err('Invoice not found: ' + invNum);
      if (String(rows[targetRow - 1][9]) === 'VOID') return err('Already voided');
      const voidNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      invSheet.getRange(targetRow, 10).setValue('VOID');                    // Col J = Status
      invSheet.getRange(targetRow, 17).setValue(String(data.reason || '')); // Col Q = Void Reason
      invSheet.getRange(targetRow, 18).setValue(String(data.voidedBy || '')); // Col R = Voided By
      invSheet.getRange(targetRow, 19).setValue(voidNow);                   // Col S = Voided At

      // ── Restore desk-sale stock deduction ──────────────────────────────
      // Desk sales (admin/warehouse) write 'Admin Sale - INV-x' deduction rows to
      // Stock Counts - Distribution at save time. Voiding must put that stock back,
      // otherwise inventory stays understated forever.
      var stockRestored = false;
      const voidCntSheet = ss.getSheetByName('Stock Counts - Distribution');
      if (voidCntSheet) {
        const cntRows = voidCntSheet.getDataRange().getValues().slice(1);
        const saleLabel = 'Admin Sale - ' + invNum;
        // qty sold per SKU according to the deduction rows of THIS invoice
        const soldBySku = {};
        const lineSheetV = ss.getSheetByName('Sales Invoice Lines');
        if (lineSheetV) {
          lineSheetV.getDataRange().getValues().slice(1).forEach(function(r){
            if (String(r[0]) !== invNum) return;
            const sku = String(r[2]).trim();
            soldBySku[sku] = (soldBySku[sku]||0) + (Number(r[4])||0);
          });
        }
        // Only restore if this invoice actually deducted desk stock
        const wasDeskSale = cntRows.some(function(r){ return String(r[2]) === saleLabel; });
        if (wasDeskSale && Object.keys(soldBySku).length) {
          // Latest balance per SKU (last row wins)
          const latestV = {};
          cntRows.forEach(function(r){
            if (!r[0] || !r[3]) return;
            const sku = String(r[3]).trim();
            latestV[sku] = {qty:Number(r[5])||0, unit:String(r[6]||'bag'), name:String(r[4]||''), category:String(r[8]||'')};
          });
          Object.keys(soldBySku).forEach(function(sku){
            if (!latestV[sku]) return;
            const restoredQty = latestV[sku].qty + soldBySku[sku];
            voidCntSheet.appendRow([
              voidNow, String(data.voidedBy||''), 'Void Reversal - ' + invNum,
              sku, latestV[sku].name, restoredQty,
              latestV[sku].unit, 'DIST', latestV[sku].category
            ]);
            latestV[sku].qty = restoredQty;
          });
          stockRestored = true;
        }
      }
      return ok({ invoiceNumber: invNum, voided: true, stockRestored: stockRestored });
    }

    // ── DEALER ACTIVITY (lightweight: last invoice date per dealer) ───────
    if (data.action === 'getRecentDealerActivity') {
      const invSheet = ss.getSheetByName('Sales Invoices');
      if (!invSheet) return ok({ activity: [] });
      const rows = invSheet.getDataRange().getValues().slice(1).filter(function(r){ return r[0]; });
      const latestMap = {};
      rows.forEach(function(r){
        const dealerId = String(r[2] || '').trim();
        if (!dealerId) return;
        const dateVal = r[4] instanceof Date
          ? Utilities.formatDate(r[4], Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(r[4] || '').slice(0, 10);
        if (!dateVal) return;
        if (!latestMap[dealerId] || dateVal > latestMap[dealerId]) {
          latestMap[dealerId] = dateVal;
        }
      });
      const activity = Object.keys(latestMap).map(function(id){
        return { dealerId: id, lastDate: latestMap[id] };
      });
      return ok({ activity: activity });
    }

    // ── VAN STOCK (driver's available qty per SKU today) ──────────────
    if (data.action === 'getVanStock') {
      const unit      = String(data.unit || '');
      const username  = String(data.createdBy || '');
      const today     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

      // 1. Load + Return movements for this unit today
      const movSheet = ss.getSheetByName('Stock Movements');
      const stockMap = {}; // {sku: {loaded, returned}}
      if (movSheet) {
        movSheet.getDataRange().getValues().slice(1).forEach(function(r) {
          if (!r[0]) return;
          const ts = r[0] instanceof Date
            ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[0]).slice(0, 10);
          if (ts !== today) return;
          if (String(r[2]) !== unit) return;
          const sku = String(r[4]).trim();
          if (!stockMap[sku]) stockMap[sku] = {loaded: 0, returned: 0};
          if (String(r[3]) === 'LOAD')   stockMap[sku].loaded   += Number(r[7]) || 0;
          if (String(r[3]) === 'RETURN') stockMap[sku].returned += Number(r[8]) || 0;
        });
      }

      // 2. Already-invoiced qty for this user today
      const invSheet2    = ss.getSheetByName('Sales Invoices');
      const invLineSheet = ss.getSheetByName('Sales Invoice Lines');
      const invoicedMap  = {}; // {sku: qty}
      if (invSheet2 && invLineSheet) {
        const todayInvNums = new Set();
        invSheet2.getDataRange().getValues().slice(1).forEach(function(r) {
          if (!r[0]) return;
          const ca = r[11] instanceof Date
            ? Utilities.formatDate(r[11], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[11]).slice(0, 10);
          if (String(r[9]) === 'VOID') return; // voided sales must release van stock
          if (ca === today && String(r[10]) === username) todayInvNums.add(String(r[0]));
        });
        invLineSheet.getDataRange().getValues().slice(1).forEach(function(r) {
          if (!r[0] || !todayInvNums.has(String(r[0]))) return;
          const sku = String(r[2]).trim();
          invoicedMap[sku] = (invoicedMap[sku] || 0) + (Number(r[4]) || 0);
        });
      }

      // 3. available = loaded − returned − already invoiced
      const vanStock = {};
      Object.keys(stockMap).forEach(function(sku) {
        const loaded    = stockMap[sku].loaded;
        const returned  = stockMap[sku].returned;
        const invoiced  = invoicedMap[sku] || 0;
        vanStock[sku] = {
          loaded:    loaded,
          returned:  returned,
          invoiced:  invoiced,
          available: Math.max(0, loaded - returned - invoiced)
        };
      });
      return ok({ vanStock: vanStock });
    }

    // ── DAY TALLY (driver end-of-day summary / admin full view) ─────────
    if (data.action === 'getDayTally') {
      const username  = String(data.createdBy || '');
      const adminView = !username || data.adminView === true;
      const today     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const invSheet3 = ss.getSheetByName('Sales Invoices');
      if (!invSheet3) return ok({ invoices: [], totals: {Cash:0,Check:0,'Terms AR':0}, grandTotal: 0 });

      const todayRows = invSheet3.getDataRange().getValues().slice(1).filter(function(r) {
        if (!r[0]) return false;
        if (String(r[9]) === 'VOID') return false; // exclude voided
        const ca = r[11] instanceof Date
          ? Utilities.formatDate(r[11], Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(r[11]).slice(0, 10);
        if (adminView) return ca === today;
        return ca === today && String(r[10]) === username;
      });

      const totals = {Cash: 0, Check: 0, 'Terms AR': 0};
      let grandTotal = 0;
      const invoices = todayRows.map(function(r) {
        const pt    = String(r[12] || 'Cash');
        const total = Number(r[8]) || 0;
        grandTotal += total;
        if (totals[pt] !== undefined) totals[pt] += total;
        else totals[pt] = (totals[pt]||0) + total;
        return {
          invoiceNumber: String(r[0]),
          contactName:   String(r[1]),
          total:         total,
          paymentType:   pt,
          createdBy:     String(r[10] || '')
        };
      });
      return ok({ invoices: invoices, totals: totals, grandTotal: grandTotal, adminView: adminView });
    }

    // ── BOTTLENECK ALERTS ─────────────────────────────────────────────
    if (data.action === 'getBottleneckAlerts') {
      const distSkuSheet = ss.getSheetByName('SKU Master');
      const distCntSheet = ss.getSheetByName('Stock Counts - Distribution');
      const poSheet      = ss.getSheetByName('Purchase Orders');
      const liSheet      = ss.getSheetByName('PO Line Items');

      // Latest stock per SKU
      const stockMap = {};
      if (distCntSheet) {
        distCntSheet.getDataRange().getValues().slice(1)
          .filter(function(r){ return r[0] && r[3]; })
          .forEach(function(r){
            const sku = String(r[3]).trim();
            const ts  = r[0] instanceof Date ? r[0] : new Date(String(r[0]));
            if (!stockMap[sku] || ts > stockMap[sku].ts)
              stockMap[sku] = { qty: Number(r[5]) || 0, ts: ts };
          });
      }

      // SKUs already covered by an open PO
      const coveredSkus = new Set();
      if (poSheet && liSheet) {
        const openStatuses = { DRAFT:true, PENDING:true, APPROVED:true, PARTIAL:true };
        const openPONums   = new Set();
        poSheet.getDataRange().getValues().slice(1)
          .filter(function(r){ return r[0] && openStatuses[String(r[3]).trim().toUpperCase()]; })
          .forEach(function(r){ openPONums.add(String(r[0]).trim()); });
        liSheet.getDataRange().getValues().slice(1)
          .filter(function(r){ return r[0] && openPONums.has(String(r[0]).trim()); })
          .forEach(function(r){ coveredSkus.add(String(r[1]).trim()); });
      }

      // Build bottleneck list: below par + no open PO
      const bottlenecks = [];
      if (distSkuSheet) {
        distSkuSheet.getDataRange().getValues().slice(4)
          .filter(function(r){ return r[0] && String(r[5]).toUpperCase() === 'YES'; })
          .forEach(function(r){
            const sku      = String(r[0]).trim();
            const parLevel = Number(r[10]) || 0;
            if (parLevel <= 0) return;
            const entry = stockMap[sku];
            const stock = entry ? Number(entry.qty) : null;
            if (stock === null || stock >= parLevel) return;
            if (coveredSkus.has(sku)) return;
            bottlenecks.push({
              sku:      sku,
              name:     String(r[1]).trim(),
              category: String(r[2]).trim(),
              supplier: String(r[7] || '').trim(),
              stock:    stock,
              parLevel: parLevel,
              shortfall: parLevel - stock
            });
          });
      }

      // Sort by criticality — fully out of stock first, then lowest stock ratio
      bottlenecks.sort(function(a, b){
        if (a.stock === 0 && b.stock > 0) return -1;
        if (b.stock === 0 && a.stock > 0) return 1;
        return (a.stock / a.parLevel) - (b.stock / b.parLevel);
      });

      return ok({ bottlenecks: bottlenecks });
    }

    // ── GET SUPPLIERS ─────────────────────────────────────────────────
    if (data.action === 'getSuppliers') {
      const sheet = getOrCreateSheet(ss, 'Suppliers', [
        'Name','Type','Contact','Default Payment Mode',
        'Default Terms','Delivery Day','Lead Time','Notes'
      ]);
      const rows = sheet.getDataRange().getValues().slice(1)
        .filter(r => r[0])
        .map(r => ({
          name:        String(r[0]),
          type:        String(r[1] || 'DIST'),
          contact:     String(r[2] || ''),
          defPayMode:  String(r[3] || ''),
          defTerms:    String(r[4] || ''),
          deliveryDay: String(r[5] || ''),
          leadTime:    String(r[6] || ''),
          notes:       String(r[7] || '')
        }));
      return ok({ suppliers: rows });
    }

    // ── ADD SUPPLIER ──────────────────────────────────────────────────
    if (data.action === 'addSupplier') {
      const sheet = getOrCreateSheet(ss, 'Suppliers', [
        'Name','Type','Contact','Default Payment Mode',
        'Default Terms','Delivery Day','Lead Time','Notes'
      ]);
      const exists = sheet.getDataRange().getValues().slice(1)
        .find(r => String(r[0]).toLowerCase() === String(data.name).toLowerCase());
      if (exists) return err('Supplier already exists: ' + data.name);
      sheet.appendRow([
        data.name, data.type || 'DIST', data.contact || '',
        data.defPayMode || '', data.defTerms || '',
        data.deliveryDay || '', data.leadTime || '', data.notes || ''
      ]);
      return ok({});
    }

    // ── UPDATE SUPPLIER ───────────────────────────────────────────────
    if (data.action === 'updateSupplier') {
      const sheet = ss.getSheetByName('Suppliers');
      if (!sheet) return err('Suppliers sheet not found');
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).toLowerCase() === String(data.originalName).toLowerCase()) {
          sheet.getRange(i+1,1).setValue(data.name);
          sheet.getRange(i+1,2).setValue(data.type        || 'DIST');
          sheet.getRange(i+1,3).setValue(data.contact     || '');
          sheet.getRange(i+1,4).setValue(data.defPayMode  || '');
          sheet.getRange(i+1,5).setValue(data.defTerms    || '');
          sheet.getRange(i+1,6).setValue(data.deliveryDay || '');
          sheet.getRange(i+1,7).setValue(data.leadTime    || '');
          sheet.getRange(i+1,8).setValue(data.notes       || '');
          return ok({});
        }
      }
      return err('Supplier not found: ' + data.originalName);
    }

    // ── REMOVE SUPPLIER ───────────────────────────────────────────────
    if (data.action === 'removeSupplier') {
      const sheet = ss.getSheetByName('Suppliers');
      if (!sheet) return err('Suppliers sheet not found');
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).toLowerCase() === String(data.name).toLowerCase()) {
          sheet.deleteRow(i + 1);
          return ok({});
        }
      }
      return err('Supplier not found: ' + data.name);
    }

    // ── DELETE PO (admin only — removes PO row + all line items) ─────────
    if (data.action === 'deletePO') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      const liSheet = ss.getSheetByName('PO Line Items');
      if (!poSheet) return err('Purchase Orders sheet not found');

      // Delete matching rows in reverse order (bottom-up) to preserve row indices
      const poRows = poSheet.getDataRange().getValues();
      for (let i = poRows.length - 1; i >= 1; i--) {
        if (String(poRows[i][0]) === data.poNumber) {
          poSheet.deleteRow(i + 1);
        }
      }
      if (liSheet) {
        const liRows = liSheet.getDataRange().getValues();
        for (let i = liRows.length - 1; i >= 1; i--) {
          if (String(liRows[i][0]) === data.poNumber) {
            liSheet.deleteRow(i + 1);
          }
        }
      }
      return ok({ deleted: data.poNumber });
    }

    // ── UPDATE PO PAYMENT DETAILS (admin — APPROVED or PARTIAL only) ─────
    if (data.action === 'updatePOPayment') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      if (!poSheet) return err('Purchase Orders sheet not found');

      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const poRows = poSheet.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < poRows.length; i++) {
        if (String(poRows[i][0]) !== data.poNumber) continue;

        const curStatus = String(poRows[i][3]);
        if (!['APPROVED','PARTIAL'].includes(curStatus)) {
          return err('Payment details can only be edited on APPROVED or PARTIAL POs');
        }

        // Build the history entry from the OLD values before overwriting
        const oldMode   = String(poRows[i][12] || '');
        const oldCheque = String(poRows[i][13] || '');
        const oldTerms  = String(poRows[i][11] || '');
        const oldDue    = String(poRows[i][14] || '');

        const oldAmount = Number(poRows[i][20] || 0);

        // Only log if there were actual old values to preserve
        if (oldMode || oldCheque || oldTerms || oldDue || oldAmount > 0) {
          const histEntry = '[' + now + ' — edited by ' + (data.editedBy || 'admin') + '] '
            + (oldMode   ? 'Mode: '   + oldMode   : '')
            + (oldCheque ? ' · Cheque #' + oldCheque : '')
            + (oldTerms  ? ' · Terms: '  + (oldTerms === '0' ? 'Upon Delivery' : oldTerms + ' days') : '')
            + (oldDue    ? ' · Due: '    + oldDue    : '')
            + (oldAmount > 0 ? ' · Amount Paid: ₱' + oldAmount : '');

          const existing = String(poRows[i][19] || '');
          const newHistory = existing ? existing + '|||' + histEntry : histEntry;
          poSheet.getRange(i + 1, 20).setValue(newHistory); // col 20 = Payment History
        }

        // Write new payment values
        poSheet.getRange(i + 1, 12).setValue(data.paymentTermsDays || '');
        poSheet.getRange(i + 1, 13).setValue(data.paymentMode      || '');
        poSheet.getRange(i + 1, 14).setValue(data.chequeRef        || '');
        poSheet.getRange(i + 1, 15).setValue(data.dueDate          || '');
        poSheet.getRange(i + 1, 21).setValue(data.amountPaid       || 0);   // col 21 = Amount Paid
        poSheet.getRange(i + 1, 22).setValue(data.overpayment      || 0);   // col 22 = Overpayment
        if(data.paymentSchedule !== undefined)
          poSheet.getRange(i + 1, 23).setValue(data.paymentSchedule ? JSON.stringify(data.paymentSchedule) : ''); // col 23 = Payment Schedule

        found = true;
        // No break — update ALL matching rows (safety for legacy duplicates)
      }

      if (!found) return err('PO not found: ' + data.poNumber);
      return ok({ poNumber: data.poNumber, updatedAt: now });
    }

    // ── MARK INSTALLMENT PAID ────────────────────────────────────────────
    if (data.action === 'markInstallmentPaid') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      if (!poSheet) return err('Purchase Orders sheet not found');
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const poRows = poSheet.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < poRows.length; i++) {
        if (String(poRows[i][0]) !== data.poNumber) continue;

        // Parse existing schedule
        let schedule = [];
        try { schedule = JSON.parse(String(poRows[i][22] || '[]')); } catch(e) { return err('Invalid payment schedule data'); }

        const idx = Number(data.installmentIndex);
        if (!schedule[idx]) return err('Installment not found at index ' + idx);
        if (schedule[idx].status === 'Paid') return err('Installment ' + (idx+1) + ' is already marked as paid');

        // Update the installment
        schedule[idx].status     = 'Paid';
        schedule[idx].paidDate   = data.paidDate   || now.split(' ')[0];
        schedule[idx].paidAmount = Number(data.paidAmount || schedule[idx].amount);
        schedule[idx].paidBy     = data.markedBy   || '';

        poSheet.getRange(i + 1, 23).setValue(JSON.stringify(schedule));
        found = true;
        // No break — update all matching rows (safety for legacy duplicates)
      }

      if (!found) return err('PO not found: ' + data.poNumber);

      // Settled instalment — pull its reminder off the calendar so only what is
      // still owed keeps showing up.
      try {
        poClearCalEvent(data.poNumber, 'PAY' + (Number(data.installmentIndex) + 1), new Date());
      } catch(e) { /* calendar is best-effort, never block the payment record */ }

      return ok({ poNumber: data.poNumber, installment: Number(data.installmentIndex) + 1, updatedAt: now });
    }

    // ── UPDATE PO DRAFT ───────────────────────────────────────────────
    if (data.action === 'updatePODraft') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      const liSheet = ss.getSheetByName('PO Line Items');
      if (!poSheet) return err('Purchase Orders sheet not found');
      const poRows = poSheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < poRows.length; i++) {
        if (String(poRows[i][0]) === data.poNumber) {
          const editableStatuses = ['DRAFT','REJECTED'];
          if (!editableStatuses.includes(String(poRows[i][3]))) return err('Only DRAFT or REJECTED POs can be edited');

          // ── Build diff for edit history ────────────────────────────────
          const oldSupplier = String(poRows[i][2] || '');
          const oldDelivery = String(poRows[i][8] || '');
          const oldNotes    = String(poRows[i][10] || '');
          const oldTotal    = Number(poRows[i][9]  || 0);
          const oldStatus   = String(poRows[i][3]  || '');
          const newSupplier = data.supplier     || oldSupplier;
          const newDelivery = data.deliveryDate || '';
          const newNotes    = data.notes        || '';
          const newTotal    = data.totalValue   || 0;
          const newStatus   = data.status       || 'DRAFT';
          const diffParts   = [];
          if (newSupplier !== oldSupplier) diffParts.push('Supplier: ' + oldSupplier + ' → ' + newSupplier);
          if (newDelivery !== oldDelivery) diffParts.push('Delivery Date: ' + (oldDelivery||'—') + ' → ' + (newDelivery||'—'));
          if (Math.round(newTotal*100) !== Math.round(oldTotal*100))
            diffParts.push('Total: ₱' + oldTotal.toLocaleString() + ' → ₱' + newTotal.toLocaleString());
          if (newStatus !== oldStatus) diffParts.push('Status: ' + oldStatus + ' → ' + newStatus);
          if (newNotes !== oldNotes)   diffParts.push('Notes updated');

          // Write updated header fields
          poSheet.getRange(i+1, 2).setValue(data.type      || poRows[i][1]);
          poSheet.getRange(i+1, 3).setValue(newSupplier);
          poSheet.getRange(i+1, 4).setValue(newStatus);
          poSheet.getRange(i+1, 9).setValue(newDelivery);
          poSheet.getRange(i+1,10).setValue(newTotal);
          poSheet.getRange(i+1,11).setValue(newNotes);

          // Write audit columns (24=Last Edited By, 25=Last Edited At, 26=Edit History)
          const editedBy  = String(data.editedBy || 'unknown');
          const editedAt  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
          const diffText  = diffParts.length ? diffParts.join(' · ') : 'No field changes (line items updated)';
          const histEntry = '[' + editedAt + ' by ' + editedBy + '] ' + diffText;
          const prevHist  = String(poRows[i][25] || '');
          const newHist   = prevHist ? prevHist + '|||' + histEntry : histEntry;
          poSheet.getRange(i+1,24).setValue(editedBy);
          poSheet.getRange(i+1,25).setValue(editedAt);
          poSheet.getRange(i+1,26).setValue(newHist);

          found = true;
          break;
        }
      }
      if (!found) return err('PO not found: ' + data.poNumber);
      // Replace line items: delete existing rows then re-append
      if (liSheet) {
        const liRows = liSheet.getDataRange().getValues();
        const toDelete = [];
        for (let i = 1; i < liRows.length; i++) {
          if (String(liRows[i][0]) === data.poNumber) toDelete.push(i + 1);
        }
        for (let i = toDelete.length - 1; i >= 0; i--) liSheet.deleteRow(toDelete[i]);
      }
      const liNew = getOrCreateSheet(ss, 'PO Line Items', [
        'PO Number','SKU Code','Item Name','Category',
        'Qty Ordered','Unit','Unit Cost','Total Cost',
        'Qty Received','Qty Outstanding','Line Status'
      ]);
      (data.lineItems || []).forEach(li => liNew.appendRow(li));
      return ok({ poNumber: data.poNumber });
    }

    // ── EDIT PO LINE ITEMS (admin only) ──────────────────────────────
    if (data.action === 'editPOLineItems') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      const liSheet = ss.getSheetByName('PO Line Items');
      if (!poSheet || !liSheet) return err('Sheets not found');

      const poNumber = String(data.poNumber || '').trim();
      if (!poNumber) return err('PO number required');

      // Locate PO row and guard against editing closed POs
      const poRows   = poSheet.getDataRange().getValues();
      var   poRowIdx = -1;
      for (var pi = 1; pi < poRows.length; pi++) {
        if (String(poRows[pi][0]).trim() === poNumber) {
          const status = String(poRows[pi][3]);
          if (['RECEIVED','CANCELLED'].includes(status))
            return err('Cannot edit line items of a ' + status + ' PO');
          poRowIdx = pi;
          break;
        }
      }
      if (poRowIdx < 0) return err('PO not found: ' + poNumber);

      // Delete existing line items for this PO (bottom-up to preserve row indices)
      const liRows    = liSheet.getDataRange().getValues();
      const toDelete  = [];
      for (var li = 1; li < liRows.length; li++) {
        if (String(liRows[li][0]).trim() === poNumber) toDelete.push(li + 1);
      }
      for (var td = toDelete.length - 1; td >= 0; td--) liSheet.deleteRow(toDelete[td]);

      // Re-append updated line items, preserving received quantities
      var newTotal = 0;
      (data.lineItems || []).forEach(function(item) {
        var qty      = Number(item.qtyOrdered)  || 0;
        var cost     = Number(item.unitCost)     || 0;
        var disc     = Number(item.discount)     || 0;
        var discType = String(item.discountType  || '%');
        var qtyRcv   = Number(item.qtyReceived)  || 0;
        var gross    = qty * cost;
        var net      = discType === '₱'
          ? Math.max(0, gross - disc * qty)
          : Math.max(0, gross * (1 - disc / 100));
        var outstanding = Math.max(0, qty - qtyRcv);
        newTotal += net;
        liSheet.appendRow([
          poNumber,
          String(item.skuCode   || ''),
          String(item.itemName  || item.skuCode || ''),
          '',                          // Category (kept blank, sourced from SKU Master)
          qty,
          String(item.unit      || 'bag'),
          cost,
          net,
          qtyRcv,
          outstanding,
          outstanding <= 0 ? 'Received' : 'Open',
          disc,
          discType
        ]);
      });

      // Update PO header: total value (col 10) and audit note appended to notes (col 11)
      poSheet.getRange(poRowIdx + 1, 10).setValue(newTotal);
      var existingNotes = String(poRows[poRowIdx][10] || '');
      var auditStamp    = '[Line items edited by ' + String(data.editedBy || 'admin')
        + ' on ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ']';
      poSheet.getRange(poRowIdx + 1, 11).setValue(
        existingNotes ? existingNotes + ' ' + auditStamp : auditStamp
      );

      return ok({ updated: (data.lineItems || []).length, newTotal: newTotal });
    }

    // ── GET BACKORDERS ────────────────────────────────────────────────
    if (data.action === 'getBackorders') {
      function mapBoRow(r, i, type) {
        return {
          rowIndex:    i + 1,          // 1-based data row (header is row 1, data starts row 2)
          type:        type,
          timestamp:   String(r[0]),
          submittedBy: String(r[1]),
          dealer:      String(r[2]),   // dealer name or customer name
          phone:       String(r[3]),
          skuCode:     String(r[4]),
          itemName:    String(r[5]),
          qty:         Number(r[6]) || 0,
          unit:        String(r[7]),
          promisedDate:String(r[8]),
          status:      String(r[9])  || 'OPEN',
          notes:       String(r[10]) || '',
          qtyServed:   Number(r[11]) || 0,
          servedDate:  String(r[12]  || '')
        };
      }
      const boDist   = ss.getSheetByName('Backorders');
      const boRetail = ss.getSheetByName('Backorders - Retail');
      const distRows   = boDist
        ? boDist.getDataRange().getValues().slice(1).filter(r=>r[0]).map((r,i)=>mapBoRow(r,i,'dist'))
        : [];
      const retailRows = boRetail
        ? boRetail.getDataRange().getValues().slice(1).filter(r=>r[0]).map((r,i)=>mapBoRow(r,i,'retail'))
        : [];
      return ok({ dist: distRows, retail: retailRows });
    }

    // ── UPDATE BACKORDER STATUS ────────────────────────────────────────
    if (data.action === 'updateBackorderStatus') {
      const boSheetName = data.boType === 'retail' ? 'Backorders - Retail' : 'Backorders';
      const boSheet = ss.getSheetByName(boSheetName);
      if (!boSheet) return err('Backorders sheet not found');
      const sheetRow = Number(data.rowIndex) + 1; // +1 for header row
      if (sheetRow < 2) return err('Invalid row index');
      // Stale-index guard: the client captured this row position when its list
      // loaded; verify the row still holds the expected backorder before writing
      if (data.expectItem) {
        const liveRow = boSheet.getRange(sheetRow, 1, 1, 11).getValues()[0];
        if (String(liveRow[5]).trim() !== String(data.expectItem).trim())
          return err('This backorder list is out of date — please refresh and try again.');
      }
      const STATUS_COL = 10; // Column J
      boSheet.getRange(sheetRow, STATUS_COL).setValue(data.status);
      // PARTIAL: also write qty served (col 12) and served date (col 13)
      if (data.status === 'PARTIAL') {
        if (data.qtyServed  != null) boSheet.getRange(sheetRow, 12).setValue(Number(data.qtyServed) || 0);
        if (data.servedDate != null) boSheet.getRange(sheetRow, 13).setValue(String(data.servedDate || ''));
      }
      return ok({});
    }

    // ── GET PENDING COUNTS (home tile badges) ─────────────────────────
    if (data.action === 'getPendingCounts') {
      // Transfer: unique IN TRANSIT transfer numbers
      let transferCount = 0;
      const trfSheet = ss.getSheetByName('Transfer Log');
      if (trfSheet) {
        const seen = {};
        trfSheet.getDataRange().getValues().slice(1).filter(r=>r[0]).forEach(r => {
          const num = String(r[0]);
          if (!seen[num] && String(r[4]).toUpperCase() === 'IN TRANSIT') {
            seen[num] = true; transferCount++;
          }
        });
      }
      // Backorders: OPEN + PARTIAL across both sheets
      let boCount = 0;
      ['Backorders','Backorders - Retail'].forEach(sn => {
        const s = ss.getSheetByName(sn);
        if (s) s.getDataRange().getValues().slice(1).filter(r=>r[0]).forEach(r => {
          const st = String(r[9]||'').toUpperCase();
          if (st === 'OPEN' || st === 'PARTIAL') boCount++;
        });
      });
      // Movement: Bajaj units with a LOAD today but no RETURN
      let movCount = 0;
      const movSheet = ss.getSheetByName('Stock Movements');
      if (movSheet) {
        const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        const loadUnits = new Set(), returnUnits = new Set();
        movSheet.getDataRange().getValues().slice(1).filter(r=>r[0]).forEach(r => {
          const ts = r[0] instanceof Date
            ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
            : String(r[0]);
          if (!ts.startsWith(today)) return;
          const mode = String(r[3]).toUpperCase();
          if (mode === 'LOAD')   loadUnits.add(String(r[2]));
          if (mode === 'RETURN') returnUnits.add(String(r[2]));
        });
        loadUnits.forEach(u => { if (!returnUnits.has(u)) movCount++; });
      }
      return ok({ transferCount, boCount, movCount });
    }

    // ── DELETE BACKORDER ───────────────────────────────────────────────
    if (data.action === 'deleteBackorder') {
      const sn = data.boType === 'retail' ? 'Backorders - Retail' : 'Backorders';
      const s  = ss.getSheetByName(sn);
      if (!s) return err('Sheet not found');
      const sheetRow = Number(data.rowIndex) + 1;
      if (sheetRow < 2) return err('Invalid row');
      // Stale-index guard — deleting the wrong row is unrecoverable
      if (data.expectItem) {
        const liveRow = s.getRange(sheetRow, 1, 1, 11).getValues()[0];
        if (String(liveRow[5]).trim() !== String(data.expectItem).trim())
          return err('This backorder list is out of date — please refresh and try again.');
      }
      s.deleteRow(sheetRow);
      return ok({});
    }

    // ── EDIT BACKORDER ─────────────────────────────────────────────────
    if (data.action === 'editBackorder') {
      const sn = data.boType === 'retail' ? 'Backorders - Retail' : 'Backorders';
      const s  = ss.getSheetByName(sn);
      if (!s) return err('Sheet not found');
      const row = Number(data.rowIndex) + 1;
      if (row < 2) return err('Invalid row');
      // Stale-index guard
      if (data.expectItem) {
        const liveRow = s.getRange(row, 1, 1, 11).getValues()[0];
        if (String(liveRow[5]).trim() !== String(data.expectItem).trim())
          return err('This backorder list is out of date — please refresh and try again.');
      }
      // Columns: 1=Timestamp 2=SubmittedBy 3=Dealer 4=Phone 5=SKU 6=Item
      //          7=Qty 8=Unit 9=PromisedDate 10=Status 11=Notes
      if (data.dealer       != null) s.getRange(row, 3).setValue(data.dealer);
      if (data.phone        != null) s.getRange(row, 4).setValue(data.phone);
      if (data.qty          != null) s.getRange(row, 7).setValue(Number(data.qty));
      if (data.promisedDate != null) s.getRange(row, 9).setValue(data.promisedDate);
      if (data.status       != null) s.getRange(row,10).setValue(data.status);
      if (data.notes        != null) s.getRange(row,11).setValue(data.notes);
      return ok({});
    }

    // ── DELETE TRANSFER ────────────────────────────────────────────────
    if (data.action === 'deleteTransfer') {
      const s = ss.getSheetByName('Transfer Log');
      if (!s) return err('Sheet not found');
      const rows = s.getDataRange().getValues();
      // Collect matching rows in reverse so indices stay valid after each delete
      for (let i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][0]) === data.trfNumber) s.deleteRow(i + 1);
      }
      return ok({});
    }

    // ── GET COUNT HISTORY ─────────────────────────────────────────────
    if (data.action === 'getCountHistory') {
      const seg = String(data.segment || 'dist').toLowerCase();
      const sheetName = seg === 'retail' ? 'Stock Counts - Retail' : 'Stock Counts - Distribution';
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) return ok({ items: [], summary: { lastCountDate: 'Never', totalSKUs: 0, varianceCount: 0, staleSKUs: 0 } });

      const rows = sheet.getDataRange().getValues().slice(1).filter(function(r){ return r[0] && r[3]; });

      // The Stock Counts sheet is a shared ledger — physical counts AND automated
      // movements (sales imports, PO receipts, transfers, production, invoice
      // stock-outs, non-count adjustments) all append here. Count History must show
      // only PHYSICAL COUNTS, otherwise a recent import masks your latest count.
      // (Van load/return rows live under Bajaj locations and are indistinguishable
      // from van counts by columns, so they are left in for Bajaj count history.)
      function isAutoSource(submittedBy, location, typeCol, catCol){
        var sb = String(submittedBy||'').toLowerCase();
        var loc = String(location||'').toLowerCase();
        var tp = String(typeCol||'').toLowerCase();
        var ct = String(catCol||'').toLowerCase();
        if (/import|xero|loyverse|system/.test(sb)) return true;            // sales imports
        if (/transfer/.test(tp) || /transfer/.test(ct)) return true;        // transfers
        if (/po.?receipt/.test(ct) || /^stock in/.test(loc)) return true;   // PO receipts
        if (/production/.test(loc) || /production/.test(ct)) return true;   // production conversions
        if (/admin sale|void reversal/.test(loc)) return true;             // invoice stock-out / void
        if (/(receive|remove|damage) adjustment/.test(loc)) return true;    // non-count adjustments
        return false;
      }

      // Build per-SKU record list, flagging the source of each row
      var skuMap = {};
      rows.forEach(function(r) {
        // Normalise timestamp — handles Date objects AND legacy "M/D/YYYY, H:MM:" strings
        var ts;
        if (r[0] instanceof Date) {
          ts = Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        } else {
          var d = new Date(String(r[0]));
          ts = isNaN(d.getTime())
            ? String(r[0])
            : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        }
        var code = String(r[3]);
        if (!skuMap[code]) skuMap[code] = { name: String(r[4]||code), unit: String(r[6]||'bag'), category: '', records: [] };
        var auto = isAutoSource(r[1], r[2], r[7], r[8]);
        // Category comes from a real count row (import/movement rows pollute col 8)
        if (!auto && !skuMap[code].category) skuMap[code].category = String(r[8]||'');
        skuMap[code].records.push({ date: ts, qty: Number(r[5])||0, submittedBy: String(r[1]||''), location: String(r[2]||''), auto: auto });
      });

      var now = new Date();
      var lastCountDate = '';
      var lastCountDateMs = 0; // track as epoch ms to avoid mixed-format string comparison bugs
      var varianceCount = 0;

      var items = [];
      Object.keys(skuMap).forEach(function(code) {
        var info = skuMap[code];
        info.records.sort(function(a,b){ return new Date(b.date)-new Date(a.date); });
        // Physical counts only — automated movements never count as a "count"
        var counts = info.records.filter(function(rec){ return !rec.auto; });
        if (!counts.length) return;   // never physically counted — not part of count history
        var latest   = counts[0];
        var prev     = counts[1] || null;
        var variance = prev != null ? latest.qty - prev.qty : null;
        var latestMs = new Date(latest.date).getTime();
        if (!isNaN(latestMs) && latestMs > lastCountDateMs) { lastCountDateMs = latestMs; lastCountDate = latest.date; }
        if (variance !== null && variance !== 0) varianceCount++;
        var daysSince = Math.floor((now - new Date(latest.date)) / 86400000);
        var isShrinkage = variance !== null && variance < -3;

        items.push({
          skuCode:     code,
          skuName:     info.name,
          category:    info.category,
          unit:        info.unit,
          lastCounted: latest.date,
          lastQty:     latest.qty,
          prevQty:     prev ? prev.qty : null,
          variance:    variance,
          submittedBy: latest.submittedBy,
          location:    latest.location,
          daysSince:   daysSince,
          isShrinkage: isShrinkage
        });
      });

      items.sort(function(a,b){ return new Date(b.lastCounted)-new Date(a.lastCounted); });

      var summary = {
        lastCountDate: lastCountDate ? lastCountDate.slice(0,16) : 'Never',
        totalSKUs:     items.length,
        varianceCount: varianceCount,
        staleSKUs:     items.filter(function(i){ return i.daysSince > 30; }).length
      };

      return ok({ items: items, summary: summary });
    }

    // ── GET COUNT ITEM HISTORY ─────────────────────────────────────────
    if (data.action === 'getCountItemHistory') {
      var seg2 = String(data.segment || 'dist').toLowerCase();
      var sName2 = seg2 === 'retail' ? 'Stock Counts - Retail' : 'Stock Counts - Distribution';
      var sheet2 = ss.getSheetByName(sName2);
      if (!sheet2) return ok({ records: [] });

      var records = sheet2.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && String(r[3]) === String(data.skuCode); })
        .map(function(r){
          var recDate;
          if (r[0] instanceof Date) {
            recDate = Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
          } else {
            var d2 = new Date(String(r[0]));
            recDate = isNaN(d2.getTime())
              ? String(r[0])
              : Utilities.formatDate(d2, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
          }
          return {
            date:        recDate,
            qty:         Number(r[5])||0,
            submittedBy: String(r[1]||''),
            location:    String(r[2]||'')
          };
        });

      records.sort(function(a,b){ return new Date(b.date)-new Date(a.date); });
      return ok({ records: records.slice(0,10) });
    }

    // ── EDIT TRANSFER ──────────────────────────────────────────────────
    if (data.action === 'editTransfer') {
      const s = ss.getSheetByName('Transfer Log');
      if (!s) return err('Sheet not found');

      if (data.lineItems && data.lineItems.length > 0) {
        // Rebuild: delete existing rows for this transfer, then re-insert
        const rows = s.getDataRange().getValues();
        var firstRowData = null;
        var rowsToDelete = [];
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === data.trfNumber) {
            if (!firstRowData) firstRowData = rows[i];
            rowsToDelete.push(i + 1); // 1-based
          }
        }
        if (!firstRowData) return err('Transfer not found');

        // Delete from bottom to top to avoid row-index shift
        for (var j = rowsToDelete.length - 1; j >= 0; j--) {
          s.deleteRow(rowsToDelete[j]);
        }

        // Re-insert with updated fields
        data.lineItems.forEach(function(li) {
          s.appendRow([
            data.trfNumber,
            firstRowData[1],                                             // fromLocation
            firstRowData[2],                                             // toLocation
            data.via    != null ? data.via    : firstRowData[3],         // via
            data.status != null ? data.status : firstRowData[4],         // status
            firstRowData[5],                                             // createdBy
            firstRowData[6],                                             // createdDate
            firstRowData[7],                                             // receivedBy
            firstRowData[8],                                             // receivedDate
            li.skuCode  || '',                                           // SKU code
            li.skuName  || '',                                           // item name
            Number(li.qty) || 0,                                         // qty dispatched
            0,                                                           // qty received (reset)
            Number(li.qty) || 0,                                         // discrepancy
            li.unit     || 'bag',                                        // unit
            data.notes  != null ? data.notes  : firstRowData[15]         // notes
          ]);
        });

      } else {
        // No line items — just update via / status / notes on all matching rows
        const rows = s.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === data.trfNumber) {
            if (data.via    != null) s.getRange(i+1, 4).setValue(data.via);
            if (data.status != null) s.getRange(i+1, 5).setValue(data.status);
            if (data.notes  != null) s.getRange(i+1,16).setValue(data.notes);
          }
        }
      }

      return ok({ trfNumber: data.trfNumber });
    }

    // ── GET MOVEMENT HISTORY ───────────────────────────────────────────
    if (data.action === 'getMovementHistory') {
      const s = ss.getSheetByName('Stock Movements');
      if (!s) return ok({ batches: [] });

      const batchMap = {};
      s.getDataRange().getValues().slice(1).forEach(function(r, i) {
        if (!r[0]) return;
        const ts = r[0] instanceof Date
          ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
          : String(r[0]);
        const key = ts + '|' + String(r[2]) + '|' + String(r[3]);
        if (!batchMap[key]) batchMap[key] = {
          batchKey:      key,
          timestamp:     ts,
          submittedBy:   String(r[1]),
          unit:          String(r[2]),
          mode:          String(r[3]),
          items:         0,
          totalLoaded:   0,
          totalReturned: 0,
          lines:         []
        };
        const loaded   = Number(r[7]) || 0;
        const returned = Number(r[8]) || 0;
        const sold     = Number(r[9]) || 0;
        batchMap[key].items++;
        batchMap[key].totalLoaded   += loaded;
        batchMap[key].totalReturned += returned;
        batchMap[key].lines.push({
          rowIndex: i + 2,  // +1 for header row, +1 for 1-based index
          sku:      String(r[4]),
          name:     String(r[5]),
          category: String(r[6]),
          loaded,
          returned,
          sold
        });
      });

      let batches = Object.values(batchMap);

      // Optional filters
      if (data.mode && data.mode !== 'All') {
        batches = batches.filter(function(b){ return b.mode.toUpperCase() === data.mode.toUpperCase(); });
      }
      if (data.date) {
        batches = batches.filter(function(b){ return b.timestamp.slice(0,10) === data.date; });
      }

      // Sort newest first — compare as real dates, fall back to string compare
      batches.sort(function(a, b) {
        const ta = new Date(a.timestamp).getTime() || 0;
        const tb = new Date(b.timestamp).getTime() || 0;
        return (tb - ta) || b.timestamp.localeCompare(a.timestamp);
      });

      return ok({ batches: batches.slice(0, Number(data.limit) || 200) });
    }

    // ── UPDATE MOVEMENT ROW (admin / staff edit) ───────────────────────
    // Editing a movement now ALSO reverses its warehouse effect: a LOAD had
    // deducted stock at submit, a RETURN had added it back — changing the
    // quantities writes a compensating Stock Counts entry so the warehouse
    // balance stays true (previously edits silently left stock drifted).
    if (data.action === 'updateMovementRow') {
      const s = ss.getSheetByName('Stock Movements');
      if (!s) return err('Stock Movements sheet not found');
      const rowIndex = Number(data.rowIndex);
      if (!rowIndex || rowIndex < 2) return err('Invalid row index');
      const allRows = s.getDataRange().getValues();
      if (rowIndex > allRows.length) return err('Row not found');
      const oldRow      = allRows[rowIndex - 1];
      const mode        = String(oldRow[3]).toUpperCase();
      const oldLoaded   = Number(oldRow[7]) || 0;
      const oldReturned = Number(oldRow[8]) || 0;
      const loaded   = Math.max(0, Number(data.loaded)   || 0);
      const returned = Math.max(0, Number(data.returned) || 0);
      const sold     = Math.max(0, loaded - returned);
      s.getRange(rowIndex,  8).setValue(loaded);
      s.getRange(rowIndex,  9).setValue(returned);
      s.getRange(rowIndex, 10).setValue(sold);

      // Warehouse compensation:
      //   LOAD row:   submit deducted `loaded` → adjust = old − new (give back reduction)
      //   RETURN row: submit added `returned`  → adjust = new − old
      const adjust = mode === 'LOAD' ? (oldLoaded - loaded)
                   : mode === 'RETURN' ? (returned - oldReturned) : 0;
      let stockAdjusted = 0;
      if (adjust !== 0) {
        const sku = String(oldRow[4]).trim();
        const cnt = getOrCreateSheet(ss, 'Stock Counts - Distribution', [
          'Timestamp','Submitted By','Location','SKU Code','Item Name','Qty On Hand','Unit','Type','Category']);
        let cur = null;
        cnt.getDataRange().getValues().slice(1).forEach(function(r){
          if (r[0] && String(r[3]).trim() === sku)
            cur = { qty:Number(r[5])||0, name:String(r[4]||''), unit:String(r[6]||'bag'), type:String(r[7]||'DIST'), cat:String(r[8]||'') };
        });
        const base = cur || { qty:0, name:String(oldRow[5]||sku), unit:'bag', type:'DIST', cat:String(oldRow[6]||'') };
        const nowE = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        cnt.appendRow([ nowE, 'Adjustment — movement edited (' + (data.editedBy||'admin') + ')', 'Correction',
          sku, base.name, base.qty + adjust, base.unit, base.type, base.cat ]);
        stockAdjusted = adjust;
      }
      return ok({ rowIndex, loaded, returned, sold, stockAdjusted });
    }

    // ── DELETE MOVEMENT BATCH ──────────────────────────────────────────
    // Deleting a batch now REVERSES its warehouse effect first: LOAD rows give
    // the bags back to warehouse stock, RETURN rows take them out again — so
    // the Product List stays accurate instead of silently drifting.
    if (data.action === 'deleteMovementBatch') {
      const s = ss.getSheetByName('Stock Movements');
      if (!s) return err('Sheet not found');
      const rows = s.getDataRange().getValues();

      // 1) Collect the batch's rows + net warehouse effect to reverse per SKU
      const delIdx = [];
      const adjBySku = {};   // sku → { adjust, name, cat }
      for (let i = 1; i < rows.length; i++) {
        const ts = rows[i][0] instanceof Date
          ? Utilities.formatDate(rows[i][0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
          : String(rows[i][0]);
        const key = ts + '|' + String(rows[i][2]) + '|' + String(rows[i][3]);
        if (key !== data.batchKey) continue;
        delIdx.push(i + 1);
        const sku  = String(rows[i][4]).trim();
        const mode = String(rows[i][3]).toUpperCase();
        // Reverse of the submit-time effect: LOAD deducted → add back; RETURN added → take out
        const adj  = mode === 'LOAD' ? (Number(rows[i][7])||0)
                   : mode === 'RETURN' ? -(Number(rows[i][8])||0) : 0;
        if (!adjBySku[sku]) adjBySku[sku] = { adjust:0, name:String(rows[i][5]||sku), cat:String(rows[i][6]||'') };
        adjBySku[sku].adjust += adj;
      }
      if (!delIdx.length) return ok({ deleted:0, stockAdjusted:0 });

      // 2) Append the compensating Stock Counts entries BEFORE deleting
      const skusToAdj = Object.keys(adjBySku).filter(function(k){ return adjBySku[k].adjust !== 0; });
      if (skusToAdj.length) {
        const cnt = getOrCreateSheet(ss, 'Stock Counts - Distribution', [
          'Timestamp','Submitted By','Location','SKU Code','Item Name','Qty On Hand','Unit','Type','Category']);
        const latest = {};
        cnt.getDataRange().getValues().slice(1).forEach(function(r){
          if (r[0] && r[3]) latest[String(r[3]).trim()] =
            { qty:Number(r[5])||0, name:String(r[4]||''), unit:String(r[6]||'bag'), type:String(r[7]||'DIST'), cat:String(r[8]||'') };
        });
        const nowD2 = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        const corr = [];
        skusToAdj.forEach(function(sku){
          const a   = adjBySku[sku];
          const cur = latest[sku] || { qty:0, name:a.name, unit:'bag', type:'DIST', cat:a.cat };
          corr.push([ nowD2, 'Reversal — movement deleted (' + (data.by||'admin') + ')', 'Correction',
            sku, cur.name || a.name, cur.qty + a.adjust, cur.unit, cur.type, cur.cat || a.cat ]);
        });
        cnt.getRange(cnt.getLastRow()+1, 1, corr.length, 9).setValues(corr);
      }

      // 3) Delete the movement rows bottom-up (indices stay valid)
      for (let d = delIdx.length - 1; d >= 0; d--) s.deleteRow(delIdx[d]);

      return ok({ deleted: delIdx.length, stockAdjusted: skusToAdj.length });
    }

    // ── MOVEMENT CORRECTION REQUESTS (staff propose → admin approve) ────
    // Staff can't edit/delete movements directly; they file a request with the
    // proposed numbers and a reason. Approving applies the change AND the
    // warehouse stock compensation in one motion; rejecting changes nothing.
    if (data.action === 'submitMovementRequest') {
      const reqSheet = getOrCreateSheet(ss, 'Movement Correction Requests', [
        'Request ID','Requested At','Requested By','Type','Batch Key','Unit','Mode',
        'Batch Time','Details','Reason','Status','Resolved By','Resolved At'
      ]);
      const nowR = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const reqId = 'MCR-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss')
        + '-' + Math.floor(Math.random()*900+100);
      if (!String(data.reason||'').trim()) return err('A reason is required');
      reqSheet.appendRow([
        reqId, nowR, String(data.requestedBy||''),
        String(data.type||'EDIT').toUpperCase() === 'DELETE' ? 'DELETE' : 'EDIT',
        String(data.batchKey||''), String(data.unit||''), String(data.mode||''),
        String(data.batchTime||''), JSON.stringify(data.lines||[]),
        String(data.reason||'').trim(), 'Pending', '', ''
      ]);
      return ok({ requestId: reqId });
    }

    if (data.action === 'getMovementRequests') {
      const reqSheet = ss.getSheetByName('Movement Correction Requests');
      if (!reqSheet) return ok({ requests: [] });
      const requests = reqSheet.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0]; })
        .map(function(r){
          let lines = [];
          try { lines = JSON.parse(String(r[8]||'[]')); } catch(e) {}
          const fmtTs = function(v){
            return v instanceof Date
              ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
              : String(v||'');
          };
          return {
            requestId: String(r[0]), requestedAt: fmtTs(r[1]), requestedBy: String(r[2]),
            type: String(r[3]), batchKey: String(r[4]), unit: String(r[5]), mode: String(r[6]),
            batchTime: fmtTs(r[7]), lines: lines, reason: String(r[9]||''),
            status: String(r[10]||'Pending'), resolvedBy: String(r[11]||''), resolvedAt: fmtTs(r[12])
          };
        })
        .reverse()      // newest first (sheet is append-only)
        .slice(0, 100);
      return ok({ requests: requests });
    }

    if (data.action === 'resolveMovementRequest') {
      if (String(data.role||'').toLowerCase() !== 'admin') return err('Admin only');
      const reqSheet = ss.getSheetByName('Movement Correction Requests');
      if (!reqSheet) return err('No requests sheet');
      const reqRows = reqSheet.getDataRange().getValues();
      let reqIdx = -1;
      for (let i = 1; i < reqRows.length; i++) {
        if (String(reqRows[i][0]) === String(data.requestId)) { reqIdx = i; break; }
      }
      if (reqIdx < 0) return err('Request not found');
      if (String(reqRows[reqIdx][10]) !== 'Pending') return err('Request already resolved');

      const nowV = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const markResolved = function(status){
        reqSheet.getRange(reqIdx+1, 11).setValue(status);
        reqSheet.getRange(reqIdx+1, 12).setValue(String(data.by||'admin'));
        reqSheet.getRange(reqIdx+1, 13).setValue(nowV);
      };

      if (String(data.decision) !== 'approve') {
        markResolved('Rejected');
        return ok({ resolved: 'Rejected' });
      }

      // ── APPROVE: locate the batch by key NOW (row indices from request time
      //    may be stale), apply the change, and write stock compensation.
      const reqType  = String(reqRows[reqIdx][3]);
      const batchKey = String(reqRows[reqIdx][4]);
      let reqLines = [];
      try { reqLines = JSON.parse(String(reqRows[reqIdx][8]||'[]')); } catch(e) {}

      const s = ss.getSheetByName('Stock Movements');
      if (!s) return err('Stock Movements sheet not found');
      const mv = s.getDataRange().getValues();
      const batchRows = [];
      for (let i = 1; i < mv.length; i++) {
        const ts = mv[i][0] instanceof Date
          ? Utilities.formatDate(mv[i][0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
          : String(mv[i][0]);
        if (ts + '|' + String(mv[i][2]) + '|' + String(mv[i][3]) !== batchKey) continue;
        batchRows.push({ row: i+1, sku: String(mv[i][4]).trim(), mode: String(mv[i][3]).toUpperCase(),
          loaded: Number(mv[i][7])||0, returned: Number(mv[i][8])||0,
          name: String(mv[i][5]||''), cat: String(mv[i][6]||'') });
      }
      if (!batchRows.length) return err('That batch no longer exists — reject this request instead.');

      const adjBySku = {}; const applied = []; const misses = [];
      const noteAdj = function(sku, adj, name, cat){
        if (adj === 0) return;
        if (!adjBySku[sku]) adjBySku[sku] = { adjust: 0, name: name, cat: cat };
        adjBySku[sku].adjust += adj;
      };

      if (reqType === 'DELETE') {
        // Reverse each row's warehouse effect, then delete the batch rows
        batchRows.forEach(function(b){
          noteAdj(b.sku, b.mode==='LOAD' ? b.loaded : b.mode==='RETURN' ? -b.returned : 0, b.name, b.cat);
        });
      } else {
        // EDIT: match each requested line to a batch row by sku + old values —
        // if the batch changed since the request, that line is skipped & reported
        const used = {};
        reqLines.forEach(function(ln){
          const m = batchRows.find(function(b){
            return !used[b.row] && b.sku === String(ln.sku).trim()
              && b.loaded === Number(ln.oldLoaded) && b.returned === Number(ln.oldReturned);
          });
          if (!m) { misses.push(String(ln.sku)); return; }
          used[m.row] = true;
          const nl = Math.max(0, Number(ln.newLoaded)||0);
          const nr = Math.max(0, Number(ln.newReturned)||0);
          s.getRange(m.row, 8).setValue(nl);
          s.getRange(m.row, 9).setValue(nr);
          s.getRange(m.row, 10).setValue(Math.max(0, nl - nr));
          noteAdj(m.sku, m.mode==='LOAD' ? (m.loaded - nl) : m.mode==='RETURN' ? (nr - m.returned) : 0, m.name, m.cat);
          applied.push(m.sku);
        });
        if (!applied.length) return err('Batch has changed since this request was filed'
          + (misses.length ? ' (no match for: ' + misses.join(', ') + ')' : '') + ' — reject it and ask staff to re-file.');
      }

      // Stock compensation rows (same pattern as direct edit/delete)
      const skusAdj = Object.keys(adjBySku).filter(function(k){ return adjBySku[k].adjust !== 0; });
      if (skusAdj.length) {
        const cnt = getOrCreateSheet(ss, 'Stock Counts - Distribution', [
          'Timestamp','Submitted By','Location','SKU Code','Item Name','Qty On Hand','Unit','Type','Category']);
        const latest = {};
        cnt.getDataRange().getValues().slice(1).forEach(function(r){
          if (r[0] && r[3]) latest[String(r[3]).trim()] =
            { qty:Number(r[5])||0, name:String(r[4]||''), unit:String(r[6]||'bag'), type:String(r[7]||'DIST'), cat:String(r[8]||'') };
        });
        const corr = [];
        skusAdj.forEach(function(sku){
          const a = adjBySku[sku];
          const cur = latest[sku] || { qty:0, name:a.name, unit:'bag', type:'DIST', cat:a.cat };
          corr.push([ nowV, 'Approved request — ' + reqType.toLowerCase() + ' ('
            + String(reqRows[reqIdx][2]) + ' → ' + (data.by||'admin') + ')', 'Correction',
            sku, cur.name || a.name, cur.qty + a.adjust, cur.unit, cur.type, cur.cat || a.cat ]);
        });
        cnt.getRange(cnt.getLastRow()+1, 1, corr.length, 9).setValues(corr);
      }

      // DELETE requests: remove the batch rows after compensation (bottom-up)
      if (reqType === 'DELETE') {
        for (let d = batchRows.length - 1; d >= 0; d--) s.deleteRow(batchRows[d].row);
      }

      markResolved('Approved');
      return ok({ resolved: 'Approved', type: reqType,
        stockAdjusted: skusAdj.length, applied: applied.length, misses: misses });
    }

    // ── STANDARD SHEET APPEND ──────────────────────────────────────────
    const sheetName = data.sheet;
    if (!sheetName) return err('No sheet name provided');
    const headerMap = {
      'Stock Movements':['Timestamp','Submitted By','Bajaj Unit','Mode',
        'SKU Code','Item Name','Category','Qty Loaded','Qty Returned','Qty Sold','Tag'],
      'Backorders':['Timestamp','Submitted By','Dealer Name','Dealer Phone',
        'SKU Code','Item Name','Qty Requested','Purchase Unit','Promised Date','Status','Notes'],
      'Backorders - Retail':['Timestamp','Submitted By','Customer Name','Contact Number',
        'SKU Code','Item Name','Qty Requested','Purchase Unit','Promised Date','Status','Notes'],
      'Production Log':[
        'Timestamp','Submitted By','Source SKU','Source Name',
        'Bags Consumed','Output SKU','Output Name','Units Produced','Ratio','Verified'
      ],
      'Purchase Orders':[
        'PO Number','Type','Supplier','Status','Created By','Created Date',
        'Approved By','Approved Date','Delivery Date','Total Value','Notes',
        'Payment Terms (days)','Payment Mode','Cheque Ref','Due Date',
        'Rejection Reason','Doc Ref #','Date Received','Received By'
      ],
      'PO Line Items':[
        'PO Number','SKU Code','Item Name','Category',
        'Qty Ordered','Unit','Unit Cost','Total Cost',
        'Qty Received','Qty Outstanding','Line Status',
        'Discount','Discount Type'
      ],
      'Stock Counts - Distribution':['Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category'],
      'Stock Counts - Retail':['Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category'],
      'Transfer Log':[
        'Transfer No','From Location','To Location','Via','Status',
        'Created By','Created Date','Received By','Received Date',
        'SKU Code','Item Name','Qty Dispatched','Qty Received',
        'Discrepancy','Unit','Notes'
      ],
      'Stock Adjustments':[
        'Batch Ref','Timestamp','Submitted By','Segment','Adj Type',
        'SKU Code','Item Name','Stock Before','Qty Input','Adj Qty',
        'Stock After','Cost (₱)','Notes'
      ],
    };
    const sheet = getOrCreateSheet(ss, sheetName, headerMap[sheetName]||null);

    // ── AUTO-CLASSIFY LOAD ROWS: INV vs OTS EXTRA ────────────────────────
    // The SERVER is the referee. Bags up to today's invoice requirement for
    // this unit count as INV (untagged); anything beyond is tagged 'OTS EXTRA'
    // — regardless of which box the client typed into. This also correctly
    // classifies rows sent by older app versions that never set a tag.
    if (sheetName === 'Stock Movements') {
      const loadRowsIn = (data.rows||[]).filter(function(r){ return String(r[3])==='LOAD'; });
      if (loadRowsIn.length) {
        const unitName = String(loadRowsIn[0][2]||'');
        const tzc = Session.getScriptTimeZone();
        const todayC = Utilities.formatDate(new Date(), tzc, 'yyyy-MM-dd');

        // 1) Today's invoice requirement per SKU for THIS unit — same routing as
        //    the Load List: Xero Division → dealer's Assigned Vehicle → unassigned
        const invNeed = {};
        const slSheet = ss.getSheetByName('Sales Log - Distribution');
        if (slSheet) {
          const cNorm = function(v){
            if (v instanceof Date) return Utilities.formatDate(v, tzc, 'yyyy-MM-dd');
            const s = String(v||'').trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
            const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (m) return m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);
            const d = new Date(s);
            return isNaN(d.getTime()) ? s : Utilities.formatDate(d, tzc, 'yyyy-MM-dd');
          };
          const dealerVeh = {};
          const dirS = ss.getSheetByName('Dealer Directory');
          if (dirS) dirS.getDataRange().getValues().slice(1).forEach(function(r){
            const nm = String(r[1]||'').trim().toLowerCase();
            if (nm) dealerVeh[nm] = String(r[17]||'').trim();
          });
          const vehS = ss.getSheetByName('Delivery Vehicles');
          const vehs = vehS ? vehS.getDataRange().getValues().slice(1)
            .filter(function(r){ return r[0]; })
            .map(function(r){ return { id:String(r[0]).trim(), div:String(r[3]||'').trim().toLowerCase() }; }) : [];
          const toVeh = function(div){
            const dl = String(div||'').trim().toLowerCase();
            if(!dl) return '';
            for (var i=0;i<vehs.length;i++) if (vehs[i].div && vehs[i].div===dl) return vehs[i].id;
            for (var j=0;j<vehs.length;j++) if (dl.indexOf(vehs[j].id.toLowerCase())>=0) return vehs[j].id;
            return '';
          };
          slSheet.getDataRange().getValues().slice(1).forEach(function(r){
            if (!r[0] || !r[4]) return;
            if (cNorm(r[1]) !== todayC) return;
            const veh = toVeh(r[15]) || dealerVeh[String(r[3]||'').trim().toLowerCase()] || '';
            if (veh !== unitName) return;
            const sku = String(r[4]).trim();
            invNeed[sku] = (invNeed[sku]||0) + (Number(r[6])||0);
          });
        }

        // 2) Invoice-loads ALREADY recorded today for this unit (untagged LOAD rows)
        const alreadyInv = {};
        sheet.getDataRange().getValues().slice(1).forEach(function(r){
          if (!r[0]) return;
          const ts = r[0] instanceof Date
            ? Utilities.formatDate(r[0], tzc, 'yyyy-MM-dd') : String(r[0]).slice(0,10);
          if (ts !== todayC || String(r[2]) !== unitName || String(r[3]) !== 'LOAD') return;
          if (String(r[10]||'').toUpperCase() === 'OTS EXTRA') return;
          const sku = String(r[4]).trim();
          alreadyInv[sku] = (alreadyInv[sku]||0) + (Number(r[7])||0);
        });

        // 3) Rebuild the rows: sum each SKU's typed total, then split by the
        //    REMAINING invoice need. RETURN rows pass through untouched.
        const bySkuC = {}, orderC = [], passThrough = [];
        (data.rows||[]).forEach(function(r){
          if (String(r[3]) !== 'LOAD') { passThrough.push(r); return; }
          const sku = String(r[4]).trim();
          if (!bySkuC[sku]) { bySkuC[sku] = { proto:r, total:0 }; orderC.push(sku); }
          bySkuC[sku].total += Number(r[7])||0;
        });
        const classified = [];
        orderC.forEach(function(sku){
          const g = bySkuC[sku];
          if (g.total <= 0) return;
          const need    = Math.max(0, (invNeed[sku]||0) - (alreadyInv[sku]||0));
          const invPart = Math.min(g.total, need);
          const otsPart = g.total - invPart;
          const p = g.proto;
          if (invPart > 0) classified.push([p[0],p[1],p[2],p[3],p[4],p[5],p[6], invPart, 0, invPart, '']);
          if (otsPart > 0) classified.push([p[0],p[1],p[2],p[3],p[4],p[5],p[6], otsPart, 0, otsPart, 'OTS EXTRA']);
        });
        data.rows = passThrough.concat(classified);
      }
    }

    data.rows.forEach(row => sheet.appendRow(row));

    // ── STOCK MOVEMENTS → STOCK COUNTS SYNC ──────────────────────────────
    // When a Stock Movement is submitted, compute the new absolute stock per
    // SKU and append a fresh entry to Stock Counts - Distribution so the
    // Product List reflects the change immediately.
    //   LOAD   → stock leaves the warehouse  → currentStock - qtyLoaded
    //   RETURN → unsold stock comes back     → currentStock + qtyReturned
    if (sheetName === 'Stock Movements') {
      // Backfill the Tag header (col 11 = 'OTS EXTRA' marker) on older sheets,
      // styled to match the other 10 headers (bold, blue fill, white text) so the
      // column doesn't look mismatched/unlabelled.
      if (sheet.getRange(1, 11).getValue() === '') {
        sheet.getRange(1, 11).setValue('Tag')
             .setFontWeight('bold').setBackground('#1F4E78').setFontColor('#FFFFFF');
      }
      const distCnt = getOrCreateSheet(ss, 'Stock Counts - Distribution',
        headerMap['Stock Counts - Distribution']);

      // Build current stock map: latest entry per SKU (sheet is append-only,
      // so the last row for a SKU is the most recent absolute count).
      const stockMap = {};
      distCnt.getDataRange().getValues().slice(1).forEach(function(r) {
        const sku = String(r[3]);
        if (!sku) return;
        stockMap[sku] = {
          qty:      Number(r[5]) || 0,
          itemName: String(r[4]),
          unit:     String(r[6]),
          type:     String(r[7]),
          category: String(r[8])
        };
      });

      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

      data.rows.forEach(function(row) {
        const mode        = String(row[3]);   // 'LOAD' or 'RETURN'
        const bajajUnit   = String(row[2]);
        const skuCode     = String(row[4]);
        const itemName    = String(row[5]);
        const category    = String(row[6]);
        const qtyLoaded   = Number(row[7]) || 0;
        const qtyReturned = Number(row[8]) || 0;

        if (!skuCode) return;

        const cur  = stockMap[skuCode] || { qty: 0, itemName: itemName,
          unit: '', type: 'Dist', category: category };
        var newQty = cur.qty;

        if      (mode === 'LOAD')   { newQty = cur.qty - qtyLoaded;   }
        else if (mode === 'RETURN') { newQty = cur.qty + qtyReturned; }
        else    { return; }  // unknown mode — skip

        // Update in-memory map so multiple rows for the same SKU chain correctly
        stockMap[skuCode] = { qty: newQty,
          itemName: cur.itemName || itemName,
          unit:     cur.unit,
          type:     cur.type,
          category: cur.category || category
        };

        // Append new absolute stock entry — buildStockMap() picks up
        // the latest row per SKU when Product List next loads.
        distCnt.appendRow([
          now,
          String(row[1]),              // Submitted By
          bajajUnit,                   // Location = Bajaj unit
          skuCode,
          cur.itemName || itemName,
          newQty,
          cur.unit     || '',
          cur.type     || 'Dist',
          cur.category || category
        ]);
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    return ok({rows: data.rows.length});

  } catch(e) {
    return err(e.toString());
  }
}

// ══════════════════════════════════════════════════════════════════
// HR / PAYROLL HELPERS — shared by getMyHR (employee view) and
// getHRSummary (admin dashboard) so the two can never disagree.
// Standard duty is 10 hours = 1 full day; hourly rate = daily ÷ 10.
// ══════════════════════════════════════════════════════════════════
const HR_TZ = 'Asia/Manila';   // payroll-critical — never trust the project tz
const HR_STD_HOURS = 10;

// ── LEAVE POLICY ──────────────────────────────────────────────────
// Shared/generic logins (not one identifiable person) can only file UNPAID
// leave — there's no individual entitlement behind them. Add usernames here
// as new shared accounts are created.
const HR_GENERIC_ACCOUNTS = ['warehouse','bajaj1','bajaj2','temp'];
const HR_VACATION_NOTICE_DAYS  = 14;   // vacation must be filed this far ahead
const HR_EMERGENCY_PER_MONTH   = 1;    // emergency leave allowance per calendar month

function hrIsGenericAccount(username) {
  return HR_GENERIC_ACCOUNTS.indexOf(String(username||'').trim().toLowerCase()) >= 0;
}
function hrLeaveTypesFor(username) {
  return hrIsGenericAccount(username)
    ? ['Unpaid Leave']
    : ['Sick Leave','Vacation Leave','Emergency Leave','Unpaid Leave'];
}
// ── OPERATING HOURS ───────────────────────────────────────────────
// One source of truth for attendance + payroll, editable by admin in-app.
//   Official Start  → when duty begins (basis for lateness)
//   Staff Cutoff    → arrive at/after this = LATE
//   Half Day After  → arrive at/after this = HALF DAY
//   Official End    → when duty ends (basis for UNDERTIME)
//   Duty Hours      → hours that make one full day (hourly rate = daily ÷ this)
function hrHmsToSec(v, fallback) {
  const hms = (v instanceof Date) ? Utilities.formatDate(v, HR_TZ, 'HH:mm:ss')
                                  : String(v||'').trim();
  const m = hms.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return fallback;
  return Number(m[1])*3600 + Number(m[2])*60 + (Number(m[3])||0);
}
function hrSecToHms(s) {
  const p2 = function(n){ return ('0'+n).slice(-2); };
  return p2(Math.floor(s/3600)) + ':' + p2(Math.floor((s%3600)/60)) + ':' + p2(s%60);
}
// ── WORK SCHEDULES ────────────────────────────────────────────────
// Named schedules (Retail, Warehouse/Driver…) so each employee is judged
// against their own hours instead of one company-wide window.
// Sheet: Name · Start · Late From · Half Day From · End · Duty Hours
function hrSchedules(ss) {
  const sh = getOrCreateSheet(ss, 'Work Schedules',
    ['Schedule','Start','Late From','Half Day From','End','Duty Hours']);
  if (sh.getLastRow() < 2) {
    sh.appendRow(['Retail',           '07:45:00','07:46:00','12:00:00','18:30:00',10]);
    sh.appendRow(['Warehouse/Driver', '07:30:00','07:31:00','12:00:00','17:30:00',10]);
  }
  const map = {};
  sh.getDataRange().getValues().slice(1).forEach(function(r){
    if (!r[0]) return;
    map[String(r[0]).trim().toLowerCase()] = {
      name:          String(r[0]).trim(),
      officialStart: hrHmsToSec(r[1], 7*3600+45*60),
      staffCutoff:   hrHmsToSec(r[2], 7*3600+46*60),
      halfDayAfter:  hrHmsToSec(r[3], 12*3600),
      officialEnd:   hrHmsToSec(r[4], 18*3600+30*60),
      dutyHours:     Number(r[5]) || HR_STD_HOURS
    };
  });
  return map;
}

// ── SCHEDULE HISTORY ──────────────────────────────────────────────
// Hours are versioned PER CUTOFF. Saving a change stamps it effective from the
// START of the current cutoff, so it applies to every log already recorded in
// that cutoff — while closed cutoffs keep the hours that were in force then.
// Sheet: Effective From (cutoff start) · Schedule · Start · Late From ·
//        Half Day From · End · Duty Hours · Changed By · Changed At
function hrScheduleHistory(ss, cutoffStart) {
  const sh = ss.getSheetByName('Schedule History');
  if (!sh || !cutoffStart) return {};
  const best = {};   // scheduleNameLower → {version, effectiveFrom}
  sh.getDataRange().getValues().slice(1).forEach(function(r){
    if (!r[0] || !r[1]) return;
    const eff = r[0] instanceof Date
      ? Utilities.formatDate(r[0], HR_TZ, 'yyyy-MM-dd') : String(r[0]).slice(0,10);
    if (eff > cutoffStart) return;             // change came after this cutoff began
    const key = String(r[1]).trim().toLowerCase();
    if (best[key] && best[key].eff > eff) return;   // keep the latest applicable
    best[key] = { eff: eff, cfg: {
      name:          String(r[1]).trim(),
      officialStart: hrHmsToSec(r[2], 7*3600+45*60),
      staffCutoff:   hrHmsToSec(r[3], 7*3600+46*60),
      halfDayAfter:  hrHmsToSec(r[4], 12*3600),
      officialEnd:   hrHmsToSec(r[5], 18*3600+30*60),
      dutyHours:     Number(r[6]) || HR_STD_HOURS
    }};
  });
  const out = {};
  Object.keys(best).forEach(function(k){ out[k] = best[k].cfg; });
  return out;
}

// Record the hours a schedule takes effect with, from the current cutoff's start
function hrRecordScheduleVersion(ss, cfg, changedBy) {
  const sh = getOrCreateSheet(ss, 'Schedule History', [
    'Effective From','Schedule','Start','Late From','Half Day From','End','Duty Hours',
    'Changed By','Changed At'
  ]);
  const eff = hrCutoffRange(0).startDate;
  const now = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd HH:mm:ss');
  const row = [ eff, cfg.name, hrSecToHms(cfg.officialStart), hrSecToHms(cfg.staffCutoff),
                hrSecToHms(cfg.halfDayAfter), hrSecToHms(cfg.officialEnd), cfg.dutyHours,
                String(changedBy||'admin'), now ];
  // One version per schedule per cutoff — a later edit in the same cutoff replaces it
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const e = rows[i][0] instanceof Date
      ? Utilities.formatDate(rows[i][0], HR_TZ, 'yyyy-MM-dd') : String(rows[i][0]).slice(0,10);
    if (e === eff && String(rows[i][1]).trim().toLowerCase() === String(cfg.name).trim().toLowerCase()) {
      sh.getRange(i+1, 1, 1, 9).setValues([row]);
      return eff;
    }
  }
  sh.appendRow(row);
  return eff;
}

// The schedule that applies to one person FOR A GIVEN CUTOFF: the version in
// force for that cutoff if one was recorded, else their current assignment.
function hrScheduleFor(ss, staffRec, fallback, cutoffStart) {
  const current = hrSchedules(ss);
  const historic = cutoffStart ? hrScheduleHistory(ss, cutoffStart) : {};
  const pick = function(key){ return historic[key] || current[key]; };

  const named = String((staffRec && staffRec.schedule) || '').trim().toLowerCase();
  if (named && pick(named)) return pick(named);
  const role = String((staffRec && staffRec.role) || '').toLowerCase();
  if (role.indexOf('retail') >= 0 && pick('retail')) return pick('retail');
  if ((role.indexOf('driver') >= 0 || role.indexOf('staff') >= 0) && pick('warehouse/driver'))
    return pick('warehouse/driver');
  // Global Operating Hours are versioned too, so an old cutoff keeps its own
  return historic['operating hours'] || fallback;
}

function hrSettings(ss) {
  const sh = getOrCreateSheet(ss, 'Attendance Settings', ['Setting','Value']);
  if (sh.getLastRow() < 2) {
    sh.appendRow(['Official Start','07:45:00']);
    sh.appendRow(['Staff Cutoff','07:46:00']);
    sh.appendRow(['Half Day After','12:00:00']);
  }
  const s = { officialStart: 7*3600+45*60, staffCutoff: 7*3600+46*60,
              halfDayAfter: 12*3600, officialEnd: 18*3600+30*60, dutyHours: HR_STD_HOURS };
  sh.getDataRange().getValues().slice(1).forEach(function(r){
    const k = String(r[0]||'').toLowerCase();
    if (r[1] === '' || r[1] == null) return;
    if (k.indexOf('official start') >= 0) s.officialStart = hrHmsToSec(r[1], s.officialStart);
    else if (k.indexOf('staff cutoff') >= 0) s.staffCutoff  = hrHmsToSec(r[1], s.staffCutoff);
    else if (k.indexOf('half day')    >= 0) s.halfDayAfter = hrHmsToSec(r[1], s.halfDayAfter);
    else if (k.indexOf('official end') >= 0) s.officialEnd  = hrHmsToSec(r[1], s.officialEnd);
    else if (k.indexOf('duty hours')   >= 0) s.dutyHours    = Number(r[1]) || s.dutyHours;
  });
  return s;
}

function hrAddDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const p2 = function(x){ return ('0'+x).slice(-2); };
  return d.getFullYear() + '-' + p2(d.getMonth()+1) + '-' + p2(d.getDate());
}

// Semi-monthly cutoff (1–15, 16–end). offset 0 = current, -1 = previous, …
function hrCutoffRange(offset) {
  const pad2 = function(n){ return ('0'+n).slice(-2); };
  const todayStr = Utilities.formatDate(new Date(), HR_TZ, 'yyyy-MM-dd');
  let cy = Number(todayStr.slice(0,4)),
      cm = Number(todayStr.slice(5,7)),
      half = Number(todayStr.slice(8,10)) <= 15 ? 1 : 2;
  for (let s = 0; s < Math.abs(Number(offset)||0); s++) {
    if (half === 2) { half = 1; }
    else { half = 2; cm--; if (cm < 1) { cm = 12; cy--; } }
  }
  const lastDay = new Date(cy, cm, 0).getDate();
  return {
    startDate: cy + '-' + pad2(cm) + '-' + (half === 1 ? '01' : '16'),
    endDate:   cy + '-' + pad2(cm) + '-' + (half === 1 ? '15' : pad2(lastDay)),
    label: Utilities.formatDate(new Date(cy, cm-1, 1), HR_TZ, 'MMM') + ' '
         + (half === 1 ? '1–15' : '16–' + lastDay) + ', ' + cy
  };
}

// Staff pay setup keyed by lowercase username
function hrStaffPay(ss) {
  const map = {};
  const sh = ss.getSheetByName('Staff');
  if (!sh) return map;
  sh.getDataRange().getValues().slice(1).forEach(function(r){
    if (!r[0]) return;
    const uname = String(r[0]).trim();
    map[uname.toLowerCase()] = {
      username:  uname,
      role:      String(r[2]||'').trim(),
      dailyRate: Number(r[20]) || 0,
      payType:   String(r[21]||'daily').toLowerCase() === 'hourly' ? 'hourly' : 'daily',
      schedule:  String(r[22]||'').trim(),   // W: assigned Work Schedule (blank = by role)
      allowance: Number(r[23]) || 0,         // X: daily allowance (drivers etc.)
      found:     true
    };
  });
  return map;
}

// All punches in the cutoff, grouped {usernameLower: {date: {timeIn,timeOut,late}}}
// First IN of the day wins (carries the late flag); last OUT wins.
function hrGroupAttendance(ss, startDate, endDate) {
  const out = {};
  const sh = ss.getSheetByName('Attendance');
  if (!sh) return out;
  sh.getDataRange().getValues().slice(1).forEach(function(r){
    if (!r[0] || !r[1]) return;
    const ts = r[0] instanceof Date
      ? Utilities.formatDate(r[0], HR_TZ, 'yyyy-MM-dd HH:mm:ss') : String(r[0]);
    const date = ts.slice(0,10);
    if (date < startDate || date > endDate) return;
    const uL = String(r[1]).trim().toLowerCase();
    if (!out[uL]) out[uL] = {};
    if (!out[uL][date]) out[uL][date] = { date:date, timeIn:'', timeOut:'', late:'', punches:[] };
    const time = ts.slice(11,19), act = String(r[2]).toUpperCase();
    // Keep EVERY punch — hourly staff may clock out when idle and back in when
    // work returns, and each worked session is paid separately.
    out[uL][date].punches.push({ time: time, act: act });
    if (act === 'IN') {
      if (!out[uL][date].timeIn) { out[uL][date].timeIn = time; out[uL][date].late = String(r[3]||''); }
    } else if (act === 'OUT') { out[uL][date].timeOut = time; }
  });
  return out;
}

// Approved cash advances per employee, with their settlement state.
// Returns {usernameLower: [{amount, settled, cutoff}]}
function hrCashAdvances(ss) {
  const map = {};
  const sh = ss.getSheetByName('Cash Advances');
  if (!sh) return map;
  sh.getDataRange().getValues().slice(1).forEach(function(r){
    if (!r[0] || !r[2]) return;
    if (String(r[5]||'').trim().toLowerCase() !== 'approved') return;
    const uL = String(r[2]).trim().toLowerCase();
    const dc = r[8] instanceof Date
      ? Utilities.formatDate(r[8], HR_TZ, 'yyyy-MM-dd') : String(r[8]||'').trim();
    if (!map[uL]) map[uL] = [];
    map[uL].push({
      id:      String(r[0]),
      amount:  Number(r[3]) || 0,
      reason:  String(r[4]||''),
      settled: String(r[9]||'').trim().toUpperCase() === 'YES',
      cutoff:  dc,                     // which cutoff it was deducted from
      // Dates were being read off the sheet and thrown away, so the dashboard
      // could only ever show a lump sum with no idea when it came from.
      requestedAt: hrCellDate(r[1]),
      approvedAt:  hrCellDate(r[7])
    });
  });
  return map;
}

// Sheet cells come back as either a Date object or a string depending on how
// the row was written. Normalise to 'yyyy-MM-dd HH:mm:ss' (or '' if empty).
function hrCellDate(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, HR_TZ, 'yyyy-MM-dd HH:mm:ss');
  return String(v).trim();
}

// How much of an employee's advances belongs to the cutoff being viewed.
//   settled   → only in the cutoff it was actually deducted from, so the
//               historical record keeps showing what they really received.
//   unsettled → against the CURRENT cutoff, since that's where it will land.
// (Older rows stored the period label instead of the start date — accept both.)
function hrAdvanceForCutoff(list, range, isCurrent) {
  let total = 0, settled = 0, outstanding = 0;
  const items = [];
  (list || []).forEach(function(a){
    if (a.settled) {
      if (a.cutoff && (a.cutoff === range.startDate || a.cutoff === range.label)) {
        total += a.amount; settled += a.amount;
        items.push(hrLineItem(a, range, 'settled'));
      }
    } else if (isCurrent) {
      total += a.amount; outstanding += a.amount;
      items.push(hrLineItem(a, range, 'outstanding'));
    }
  });
  items.sort(hrByDate);
  return { total: total, settled: settled, outstanding: outstanding, items: items };
}

// One displayable line for an advance or reimbursement, carrying the dates the
// dashboard needs and — crucially — whether it was raised BEFORE the cutoff it
// is being charged to. An unsettled item always lands on the current cutoff,
// which is correct, but without saying so a July request looks like a new one.
function hrLineItem(x, range, state) {
  const asked = String(x.requestedAt || '').slice(0,10);
  return {
    id:          x.id || '',
    amount:      x.amount,
    state:       state,
    requestedAt: x.requestedAt || '',
    approvedAt:  x.approvedAt  || '',
    note:        x.reason || x.description || x.category || '',
    // Carried over means "still unsettled and older than this cutoff" — that
    // is the case that confuses. A settled item sits in the cutoff it was
    // actually deducted from, so it is history, not something rolling forward.
    carriedOver: state === 'outstanding' && !!(asked && asked < range.startDate),
    fromCutoff:  hrCutoffLabelFor(asked)
  };
}
// Oldest first, so the longest-outstanding item is top of the list.
// Rows with no date go last rather than masquerading as the oldest.
function hrByDate(a, b) {
  const x = String(a.requestedAt||''), y = String(b.requestedAt||'');
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return x < y ? -1 : x > y ? 1 : 0;
}

// Which semi-monthly cutoff a given date belongs to, as a readable label.
function hrCutoffLabelFor(dateStr) {
  const d = String(dateStr || '').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  const y = Number(d.slice(0,4)), m = Number(d.slice(5,7)), day = Number(d.slice(8,10));
  const last = new Date(y, m, 0).getDate();
  const mon  = Utilities.formatDate(new Date(y, m-1, 1), HR_TZ, 'MMM');
  return mon + ' ' + (day <= 15 ? '1–15' : '16–' + last) + ', ' + y;
}

// ── REIMBURSEMENTS (expenses the employee paid for, added back to pay) ──
// Sheet cols: 0 ID · 1 Requested At · 2 Requested By · 3 Amount · 4 Category ·
//   5 Expense Date · 6 Description · 7 Receipt · 8 Status · 9 Resolved By ·
//   10 Resolved At · 11 Paid Cutoff · 12 Paid
function hrReimbursements(ss) {
  const map = {};
  const sh = ss.getSheetByName('Reimbursements');
  if (!sh) return map;
  sh.getDataRange().getValues().slice(1).forEach(function(r){
    if (!r[0] || !r[2]) return;
    if (String(r[8]||'').trim().toLowerCase() !== 'approved') return;
    const uL = String(r[2]).trim().toLowerCase();
    const pc = r[11] instanceof Date
      ? Utilities.formatDate(r[11], HR_TZ, 'yyyy-MM-dd') : String(r[11]||'').trim();
    if (!map[uL]) map[uL] = [];
    map[uL].push({ id:     String(r[0]),
                   amount: Number(r[3]) || 0,
                   category: String(r[4]||''),
                   description: String(r[6]||''),
                   paid:   String(r[12]||'').trim().toUpperCase() === 'YES',
                   cutoff: pc,
                   requestedAt: hrCellDate(r[1]),
                   approvedAt:  hrCellDate(r[10]) });
  });
  return map;
}

// Same cutoff rule as advances, but it ADDS: an approved-unpaid reimbursement
// lands on the current cutoff; once paid it stays on the cutoff it was paid in.
function hrReimburseForCutoff(list, range, isCurrent) {
  let total = 0, paid = 0, outstanding = 0;
  const items = [];
  (list || []).forEach(function(x){
    if (x.paid) {
      if (x.cutoff && (x.cutoff === range.startDate || x.cutoff === range.label)) {
        total += x.amount; paid += x.amount;
        items.push(hrLineItem(x, range, 'paid'));
      }
    } else if (isCurrent) {
      total += x.amount; outstanding += x.amount;
      items.push(hrLineItem(x, range, 'outstanding'));
    }
  });
  items.sort(hrByDate);
  return { total: total, paid: paid, outstanding: outstanding, items: items };
}

// ── MANUAL ADDITIONAL PAY (admin-entered allowance / incentive / bonus) ──
// Sheet cols: 0 ID · 1 Created At · 2 Created By · 3 Employee · 4 Date ·
//   5 Type · 6 Amount · 7 Note · 8 Status (Active|Cancelled)
// Distinct from the Staff daily-allowance field, which auto-pays per day worked.
// These are one-off amounts and in most cutoffs there will be none at all.
function hrAdditionalPay(ss) {
  const map = {};
  const sh = ss.getSheetByName('Additional Pay');
  if (!sh) return map;
  sh.getDataRange().getValues().slice(1).forEach(function(r){
    if (!r[0] || !r[3] || !r[4]) return;
    if (String(r[8]||'Active').trim().toLowerCase() === 'cancelled') return;
    const amt = Number(r[6]) || 0;
    if (!amt) return;
    const uL = String(r[3]).trim().toLowerCase();
    const d  = r[4] instanceof Date
      ? Utilities.formatDate(r[4], HR_TZ, 'yyyy-MM-dd') : String(r[4]).slice(0,10);
    if (!map[uL]) map[uL] = [];
    map[uL].push({
      id:     String(r[0]),
      date:   d,
      type:   String(r[5]||'Other').trim(),
      amount: amt,
      note:   String(r[7]||''),
      createdBy: String(r[2]||'')
    });
  });
  return map;
}

// An entry belongs to the cutoff its DATE falls in — not the cutoff it was typed
// in. So a back-dated incentive lands in the cutoff being closed, and once that
// cutoff passes the entry stays put instead of drifting onto the next payout.
function hrAddPayForCutoff(list, range) {
  const items = [];
  let total = 0;
  (list || []).forEach(function(x){
    if (x.date >= range.startDate && x.date <= range.endDate) {
      items.push(x);
      total += x.amount;
    }
  });
  items.sort(function(a,b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return { total: total, items: items };
}

// ── MANUAL DEDUCTIONS (collection shortage, damage, penalties) ──
// Sheet cols: 0 ID · 1 Created At · 2 Created By · 3 Employee · 4 Date ·
//   5 Type · 6 Amount · 7 Note · 8 Status (Active|Cancelled)
// Exact mirror of Additional Pay, but it subtracts. Separate from the
// automatic lateness/undertime deductions, which the pay engine works out
// from the time records — these are things an admin decides and must justify.
function hrDeductions(ss) {
  const map = {};
  const sh = ss.getSheetByName('Pay Deductions');
  if (!sh) return map;
  sh.getDataRange().getValues().slice(1).forEach(function(r){
    if (!r[0] || !r[3] || !r[4]) return;
    if (String(r[8]||'Active').trim().toLowerCase() === 'cancelled') return;
    const amt = Number(r[6]) || 0;
    if (!amt) return;
    const uL = String(r[3]).trim().toLowerCase();
    const d  = r[4] instanceof Date
      ? Utilities.formatDate(r[4], HR_TZ, 'yyyy-MM-dd') : String(r[4]).slice(0,10);
    if (!map[uL]) map[uL] = [];
    map[uL].push({
      id:     String(r[0]),
      date:   d,
      type:   String(r[5]||'Other').trim(),
      amount: amt,
      note:   String(r[7]||''),
      createdBy: String(r[2]||'')
    });
  });
  return map;
}

// Same cutoff rule as additional pay: the entry's own DATE decides which
// cutoff it lands in, so a back-dated shortage hits the period it happened in.
function hrDeductForCutoff(list, range) {
  const items = [];
  let total = 0;
  (list || []).forEach(function(x){
    if (x.date >= range.startDate && x.date <= range.endDate) {
      items.push(x);
      total += x.amount;
    }
  });
  items.sort(function(a,b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return { total: total, items: items };
}

// ── PER-DAY PAY ADJUSTMENTS (admin void / hold, with employee reply) ──
// Sheet cols: 0 ID · 1 Created At · 2 Created By · 3 Employee · 4 Date ·
//   5 Type (VOID|HOLD) · 6 Reason · 7 Status (Active|Released|Cancelled) ·
//   8 Employee Response · 9 Responded At · 10 Resolved By · 11 Resolved At
function hrPayAdjustments(ss) {
  const map = {};
  const sh = ss.getSheetByName('Pay Adjustments');
  if (!sh) return map;
  sh.getDataRange().getValues().slice(1).forEach(function(r){
    if (!r[0] || !r[3] || !r[4]) return;
    const uL = String(r[3]).trim().toLowerCase();
    const d  = r[4] instanceof Date
      ? Utilities.formatDate(r[4], HR_TZ, 'yyyy-MM-dd') : String(r[4]).slice(0,10);
    if (!map[uL]) map[uL] = {};
    map[uL][d] = {
      id:       String(r[0]),
      type:     String(r[5]||'HOLD').toUpperCase() === 'VOID' ? 'VOID' : 'HOLD',
      reason:   String(r[6]||''),
      status:   String(r[7]||'Active'),
      response: String(r[8]||''),
      respondedAt: r[9] instanceof Date
        ? Utilities.formatDate(r[9], HR_TZ, 'yyyy-MM-dd HH:mm:ss') : String(r[9]||''),
      createdBy: String(r[2]||'')
    };
  });
  return map;
}

// The pay engine. byDay = {date:{timeIn,timeOut,late}}.
//   HOURLY → pay = hours worked (IN→OUT, capped at 10h) × (rate ÷ 10).
//            No late/half-day deduction: arriving late already shortens the
//            hours, so deducting again would charge the same lost time twice.
//   DAILY  → full rate, minus (rate ÷ 10) per hour late, or rate ÷ 2 for half day.
function hrComputeDays(byDay, dailyRate, payType, cfg, adjustments) {
  const ADJ = adjustments || {};
  const S = cfg || { officialStart: 7*3600+45*60, officialEnd: 18*3600+30*60,
                     dutyHours: HR_STD_HOURS };
  const dutyHours  = S.dutyHours || HR_STD_HOURS;
  const hourlyRate = dailyRate / dutyHours;
  // Hourly duty window: official start → +duty hours. Only time inside is paid.
  const winStart = S.officialStart;
  const winEnd   = winStart + dutyHours*3600;
  const toSec = function(t){
    const p = String(t||'').split(':');
    if (p.length < 2) return NaN;
    return Number(p[0])*3600 + Number(p[1])*60 + (Number(p[2])||0);
  };
  // Lateness comes from the flag stamped at clock-in — that IS the audit record
  // in the Attendance sheet, so payroll and the sheet always agree.
  const lateMinsOf = function(flag){
    const m = flag.match(/(\d+)\s*m/), s = flag.match(/(\d+)\s*s/);
    return (m ? Number(m[1]) : 0) + (s ? Number(s[1])/60 : 0);
  };

  let daysWorked = 0, lateDays = 0, halfDays = 0, lateMinutes = 0;
  let gross = 0, lateDeduction = 0, halfDayDeduction = 0;
  let hoursPaid = 0, otHours = 0, fullDays = 0, incompleteDays = 0;
  let undertimeDays = 0, undertimeMinutes = 0, undertimeDeduction = 0;

  const days = Object.keys(byDay).sort().map(function(d){
    const rec  = byDay[d];
    const flag = String(rec.late||'');

    if (payType === 'hourly') {
      if (!rec.timeIn) {
        return { date:rec.date, timeIn:'', timeOut:rec.timeOut, status:'No time-in',
                 hours:0, ot:0, deduction:0, pay:0, incomplete:true };
      }
      // Pair the day's punches into worked SESSIONS. Hourly staff clock out when
      // they run out of tasks and back in when work returns — each IN→OUT block
      // is paid, and the idle gaps between them are not.
      const punches = (rec.punches && rec.punches.length)
        ? rec.punches.slice().sort(function(a,b){ return a.time < b.time ? -1 : 1; })
        : [{time:rec.timeIn,act:'IN'}].concat(rec.timeOut ? [{time:rec.timeOut,act:'OUT'}] : []);
      const sessions = [];
      let openIn = null, unclosed = false;
      punches.forEach(function(p){
        if (p.act === 'IN') { if (openIn === null) openIn = toSec(p.time); }
        else if (p.act === 'OUT' && openIn !== null) {
          const e = toSec(p.time);
          if (!isNaN(e) && e > openIn) sessions.push({ s: openIn, e: e });
          openIn = null;
        }
      });
      if (openIn !== null) unclosed = true;    // clocked in and never back out

      if (!sessions.length) {
        incompleteDays++;
        return { date:rec.date, timeIn:rec.timeIn, timeOut:rec.timeOut,
                 status: rec.timeOut ? 'Check times' : 'No time-out',
                 hours:0, ot:0, sessions:0, deduction:0, pay:0, incomplete:true };
      }
      daysWorked++;
      // Paid = the part of each session INSIDE the duty window. A late arrival
      // permanently loses the front of the window; time past the window end is
      // overtime, and idle time between sessions is simply never counted.
      let paidSec = 0, rawSec = 0;
      sessions.forEach(function(x){
        rawSec  += (x.e - x.s);
        paidSec += Math.max(0, Math.min(x.e, winEnd) - Math.max(x.s, winStart));
      });
      const rawHrs  = rawSec / 3600;
      const paidHrs = paidSec / 3600;
      const ot      = Math.max(0, rawHrs - paidHrs);   // worked outside the window
      const lostHrs = dutyHours - paidHrs;             // window time not covered
      const pay     = paidHrs * hourlyRate;
      hoursPaid += paidHrs; otHours += ot; gross += pay;
      if (paidHrs >= dutyHours - 0.0001) fullDays++;
      if (unclosed) incompleteDays++;
      // No lateness tracking for hourly — unpaid time IS the consequence
      const hStr = Math.floor(paidHrs) + 'h ' + Math.round((paidHrs % 1) * 60) + 'm';
      const sesNote = sessions.length > 1 ? ' · ' + sessions.length + ' sessions' : '';
      return { date:rec.date, timeIn:rec.timeIn, timeOut:rec.timeOut,
               status: (paidHrs >= dutyHours - 0.0001 ? 'Full day (' + hStr + ')' : hStr)
                       + sesNote + (unclosed ? ' · ⚠ still clocked in' : ''),
               hours: Math.round(paidHrs*100)/100, ot: Math.round(ot*100)/100,
               sessions: sessions.length,
               deduction: Math.round(Math.max(0,lostHrs) * hourlyRate * 100)/100,
               pay: Math.round(pay*100)/100, incomplete: unclosed };
    }

    // DAILY — full rate, minus lateness and/or undertime (or half day)
    let status = 'On time', pay = dailyRate, ded = 0;
    if (!rec.timeIn) {
      status = 'No time-in'; pay = 0;
    } else {
      daysWorked++;
      gross += dailyRate;
      if (/half\s*day/i.test(flag)) {
        // Half day already halves the pay — no extra late/undertime on top
        halfDays++; status = 'Half day';
        ded = dailyRate / 2; halfDayDeduction += ded;
      } else {
        const parts = [];
        const inSec = toSec(rec.timeIn), oS = toSec(rec.timeOut);

        if (/late/i.test(flag)) {
          lateDays++;
          const mins = lateMinsOf(flag);
          lateMinutes += mins;
          const ld = (dailyRate / dutyHours) * (mins / 60);
          lateDeduction += ld; ded += ld;
          parts.push(flag);
        }

        if (!rec.timeOut) {
          // Never clocked out — they clearly worked, but there's no proof of
          // when they left. Half day, clearly flagged. (Previously this paid in
          // FULL, so forgetting to clock out beat clocking out early.)
          incompleteDays++;
          const nd = dailyRate / 2;
          halfDayDeduction += nd; ded += nd;
          parts.push('⚠ NO TIME-OUT · half day');
        } else if (isNaN(oS) || oS <= inSec) {
          // Out before in — impossible data (a stray punch). Flag it; never
          // invent a huge undertime from it.
          incompleteDays++;
          parts.push('⚠ CHECK TIMES — needs correction');
        } else if (oS < S.officialEnd) {
          const uMins = (S.officialEnd - oS) / 60;
          undertimeDays++; undertimeMinutes += uMins;
          const ud = (dailyRate / dutyHours) * (uMins / 60);
          undertimeDeduction += ud; ded += ud;
          parts.push('UNDERTIME −' + Math.floor(uMins/60) + 'h ' + Math.round(uMins%60) + 'm');
        }
        if (parts.length) status = parts.join(' · ');
      }
      pay = Math.max(0, dailyRate - ded);   // never negative
    }
    return { date:rec.date, timeIn:rec.timeIn, timeOut:rec.timeOut, status:status,
             hours:0, ot:0, deduction:Math.round(ded*100)/100,
             pay:Math.round(pay*100)/100, incomplete:false };
  });

  // ── Apply admin VOID / HOLD on specific days ──────────────────────
  // Runs after normal pay is computed: whatever the day would have paid becomes
  // a deduction, so the payslip still shows the day worked and the amount held.
  let heldDays = 0, heldDeduction = 0, voidedDays = 0, heldPending = 0;
  days.forEach(function(d){
    const a = ADJ[d.date];
    if (!a || a.status !== 'Active') return;
    if (d.pay > 0) { heldDeduction += d.pay; d.deduction = Math.round((d.deduction + d.pay)*100)/100; }
    d.pay = 0;
    d.adjustment = { id:a.id, type:a.type, reason:a.reason,
                     response:a.response, respondedAt:a.respondedAt, createdBy:a.createdBy };
    d.status = (a.type === 'VOID' ? '⛔ VOID — ' : '⏸ HELD — ') + a.reason;
    if (a.type === 'VOID') voidedDays++; else heldDays++;
    if (!a.response) heldPending++;      // employee hasn't answered yet
  });

  return { daysWorked:daysWorked, lateDays:lateDays, halfDays:halfDays,
           heldDays:heldDays, voidedDays:voidedDays, heldDeduction:heldDeduction,
           awaitingResponse:heldPending,
           lateMinutes:lateMinutes, gross:gross,
           lateDeduction:lateDeduction, halfDayDeduction:halfDayDeduction,
           undertimeDays:undertimeDays, undertimeMinutes:undertimeMinutes,
           undertimeDeduction:undertimeDeduction,
           totalDeduction: lateDeduction + halfDayDeduction + undertimeDeduction + heldDeduction,
           hoursPaid:hoursPaid, otHours:otHours, fullDays:fullDays,
           incompleteDays:incompleteDays, days:days };
}

// ══════════════════════════════════════════════════════════════════
// PO CALENDAR REMINDERS
// One entry per PO per purpose, found by its tag in the description so a
// partial delivery updates the existing reminder instead of adding another.
//   DELIVERY — created on approval, cleared once goods arrive
//   PAYMENT  — created on first receipt, updated on every later receipt
// ══════════════════════════════════════════════════════════════════
function poCalTag(poNumber, kind) {
  return '[AEON:' + kind + ':' + String(poNumber).trim() + ']';
}

// Find an existing reminder for this PO by scanning a window around the date
function poFindCalEvent(cal, poNumber, kind, aroundDate) {
  const from = new Date(aroundDate); from.setDate(from.getDate() - 120);
  const to   = new Date(aroundDate); to.setDate(to.getDate() + 400);
  const tag  = poCalTag(poNumber, kind);
  const hits = cal.getEvents(from, to, { search: String(poNumber).trim() });
  for (var i = 0; i < hits.length; i++) {
    if (String(hits[i].getDescription() || '').indexOf(tag) >= 0) return hits[i];
  }
  return null;
}

// Create or update a PO reminder. Returns a short note for the API response.
function poUpsertCalEvent(poNumber, kind, title, dueDate, descLines) {
  try {
    const cal = CalendarApp.getDefaultCalendar();
    if (!cal) return 'No default calendar';
    const desc  = descLines.filter(Boolean).join('\n') + '\n\n' + poCalTag(poNumber, kind);
    const found = poFindCalEvent(cal, poNumber, kind, dueDate);
    if (found) {
      found.setTitle(title);
      found.setDescription(desc);
      found.setAllDayDate(dueDate);
      return 'Updated ' + kind.toLowerCase() + ' reminder for '
        + Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'MMM d, yyyy');
    }
    const ev = cal.createAllDayEvent(title, dueDate, { description: desc });
    const msLeft = dueDate.getTime() - new Date().getTime();
    if (msLeft > 7*24*60*60000) ev.addPopupReminder(7*24*60);
    if (msLeft > 3*24*60*60000) ev.addPopupReminder(3*24*60);
    if (msLeft > 1*24*60*60000) ev.addPopupReminder(1*24*60);
    return 'Created ' + kind.toLowerCase() + ' reminder for '
      + Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'MMM d, yyyy');
  } catch (e) {
    return 'ERROR: ' + e.toString();
  }
}

// Once goods arrive the "delivery expected" nudge has done its job
function poClearCalEvent(poNumber, kind, aroundDate) {
  try {
    const cal = CalendarApp.getDefaultCalendar();
    if (!cal) return false;
    const ev = poFindCalEvent(cal, poNumber, kind, aroundDate);
    if (ev) { ev.deleteEvent(); return true; }
  } catch (e) {}
  return false;
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1,1,1,headers.length)
           .setFontWeight('bold').setBackground('#1F4E78').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({status:'ok',...data}))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({status:'error',msg}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ok({msg:'Alfrisco Inventory webhook active'});
}

// ── RUN THIS ONCE from the Apps Script editor to authorize Calendar access ──
// Extensions → Apps Script → select testCalendar → Run
// Google will show a consent dialog — click Allow.
// Then re-deploy (Deploy → Manage Deployments → pencil → New version → Deploy).
function testCalendar() {
  const cal   = CalendarApp.getDefaultCalendar();
  const today = new Date();
  const event = cal.createAllDayEvent('[TEST] AE-ON Calendar Auth OK', today, {
    description: 'You can delete this event — it confirms Calendar access is authorized.'
  });
  Logger.log('Calendar test passed. Event ID: ' + event.getId());
}
