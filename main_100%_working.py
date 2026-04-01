import http.client
import json
import pandas as pd
import re

def send_bulk_sms_from_excel(file_path):
    # Load and normalize column headers
    df = pd.read_excel(file_path, sheet_name='Sheet1')
    df.columns = [col.strip().replace("\n", " ") for col in df.columns]
    normalized_cols = [col.lower() for col in df.columns]

    # Identify starting point from 'Gross Salary'
    try:
        start_col = normalized_cols.index("gross salary")
    except ValueError:
        print("❌ 'Gross Salary' column not found. Found columns are:", df.columns.tolist())
        return

    conn = http.client.HTTPSConnection("smsplus.sslwireless.com")
    headers_api = {'Content-type': 'application/json'}

    for _, row in df.iterrows():
        try:
            emp_id = str(row["Emp ID"]).strip()
            pay_days = str(row["Pay. Days"]).strip()
            gross_pay = row["Gross Salary"]
            # Format Excel date to "Jul-25"
            month_raw = row["Month"]
            if isinstance(month_raw, pd.Timestamp):
                month_value = month_raw.strftime("%b-%y").replace("-", "")
            else:
                month_value = str(month_raw).strip()

            mobile = str(row["Phone Number"]).strip()

            if pd.isna(emp_id) or pd.isna(gross_pay) or pd.isna(month_value) or pd.isna(mobile):
                continue  # Skip invalid rows

            sms_parts = [
                f"PaySlip-{month_value}",
                f"EmpID: {emp_id}",
                f"PayDays: {pay_days}",
                f"GROSS-{gross_pay:,.1f}"
            ]

            # Loop from 'Gross Salary' to the end, excluding Month
            for col in df.columns[start_col + 1:]:
                if col.strip().lower() == "month":
                    continue
                val = row[col]
                if pd.notna(val) and isinstance(val, (int, float)) and val > 0:
                    label = col.strip().replace("\n", " ")
                    sms_parts.append(f"{label}-{val:,.1f}")

            sms = ", ".join(sms_parts)

            # Clean csms_id to avoid invalid characters
            sanitized_month = re.sub(r"[^\w]", "", month_value)
            csms_id = f"sms_{emp_id}_{sanitized_month}"

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
            print(f"Sent to {mobile}: {res.status} - {res.read().decode('utf-8')}")

            # Re-open connection for next request
            conn.close()
            conn = http.client.HTTPSConnection("smsplus.sslwireless.com")

        except Exception as e:
            print(f"⚠️ Failed to send to {row.get('Phone Number', 'N/A')}: {e}")

# Run the function
send_bulk_sms_from_excel("sbook.xlsx")
