import http.client
import json
import pandas as pd
import re
import os

def save_excel_with_fallback(df, base_filename):
    """Save DataFrame to Excel, retry with incremented filenames if file is locked."""
    base_name, ext = os.path.splitext(base_filename)
    counter = 1
    filename = base_filename
    while True:
        try:
            df.to_excel(filename, index=False)
            print(f"📄 Duplicate records exported to '{filename}'. Aborting SMS sending.\n")
            break
        except PermissionError:
            filename = f"{base_name}_{counter}{ext}"
            counter += 1

def send_bulk_sms_from_excel(file_path):
    df = pd.read_excel(file_path, sheet_name='Sheet1')
    df.columns = [col.strip().replace("\n", " ") for col in df.columns]

    # 🔍 Check for duplicates
    duplicate_emp_ids = df[df.duplicated(subset=['Emp ID'], keep=False)]
    duplicate_phones = df[df.duplicated(subset=['Phone Number'], keep=False)]

    if not duplicate_emp_ids.empty or not duplicate_phones.empty:
        duplicates = pd.concat([duplicate_emp_ids, duplicate_phones]).drop_duplicates()
        save_excel_with_fallback(duplicates, "sms_duplicates.xlsx")

        print("❌ Duplicate entries found!")
        if not duplicate_emp_ids.empty:
            print(f"- Duplicate Emp IDs: {duplicate_emp_ids['Emp ID'].unique().tolist()}")
        if not duplicate_phones.empty:
            print(f"- Duplicate Phone Numbers: {duplicate_phones['Phone Number'].unique().tolist()}")
        return  # ❌ Abort

    # ✅ Proceed if no duplicates
    normalized_cols = [col.lower() for col in df.columns]
    try:
        start_col = normalized_cols.index("gross salary")
    except ValueError:
        print("❌ 'Gross Salary' column not found. Found columns are:", df.columns.tolist())
        return

    results = []
    conn = http.client.HTTPSConnection("smsplus.sslwireless.com")
    headers_api = {'Content-type': 'application/json'}

    for _, row in df.iterrows():
        try:
            emp_id = str(row["Emp ID"]).strip()
            pay_days = str(row["Pay. Days"]).strip()
            gross_pay = row["Gross Salary"]
            month_raw = row["Month"]
            if isinstance(month_raw, pd.Timestamp):
                month_value = month_raw.strftime("%b-%y")
            else:
                month_value = str(month_raw).strip()

            mobile = str(row["Phone Number"]).strip()

            if pd.isna(emp_id) or pd.isna(gross_pay) or pd.isna(month_value) or pd.isna(mobile):
                continue  # skip incomplete rows

            # 📤 Prepare SMS content and log fields
            sms_fields = {
                "Emp ID": emp_id,
                "Month": month_value,
                "PayDays": pay_days,
                "Gross Salary": gross_pay
            }

            sms_parts = [
                f"PaySlip-{month_value}",
                f"EmpID: {emp_id}",
                f"PayDays: {pay_days}",
                f"GROSS-{gross_pay:,.1f}"
            ]

            for col in df.columns[start_col + 1:]:
                if col.strip().lower() == "month":
                    continue
                val = row[col]
                if pd.notna(val) and isinstance(val, (int, float)) and val > 0:
                    label = col.strip().replace("\n", " ")
                    sms_parts.append(f"{label}-{val:,.1f}")
                    sms_fields[label] = val

            sms = ", ".join(sms_parts)
            csms_id = f"sms_{emp_id}_{re.sub(r'[^\w]', '', month_value)}"

            payload = {
                "api_token": "Ispahani-c1f14263-de77-4a9d-8e59-36cafdb7da4c",
                "sid": "ISPAHANIAPI",
                "sms": sms,
                "msisdn": mobile,
                "csms_id": csms_id
            }

            payload_json = json.dumps(payload)
            conn.request("POST", "/api/v3/send-sms", payload_json, headers_api)
            res = conn.getresponse()
            response_text = res.read().decode('utf-8')

            status = "Success" if res.status == 200 else "Failed"
            sms_fields["Status"] = status
            sms_fields["Message"] = response_text

            print(f"✅ Sent to {mobile}: {res.status} - {response_text}")
            results.append(sms_fields)

            # Reopen connection
            conn.close()
            conn = http.client.HTTPSConnection("smsplus.sslwireless.com")

        except Exception as e:
            error_msg = str(e)
            results.append({
                "Emp ID": row.get("Emp ID", ""),
                "Month": str(row.get("Month", "")).strip(),
                "PayDays": row.get("Pay. Days", ""),
                "Gross Salary": row.get("Gross Salary", ""),
                "Status": "Failed",
                "Message": error_msg
            })
            print(f"⚠️ Failed to send to {row.get('Phone Number', 'N/A')}: {error_msg}")

    # 💾 Export results
    result_df = pd.DataFrame(results)
    try:
        result_df.to_excel("sms_results.xlsx", index=False)
        print("\n📄 SMS Results saved to 'sms_results.xlsx'")
    except PermissionError:
        # Fallback if the result file is open
        save_excel_with_fallback(result_df, "sms_results.xlsx")

# Run the function
send_bulk_sms_from_excel("sbook.xlsx")
