
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
from db import get_db_connection
import mysql.connector
import json
import re
import csv
import io
from flask_bcrypt import Bcrypt

app = Flask(__name__)
CORS(app)
bcrypt = Bcrypt(app)


@app.route("/")
def home():
    return jsonify({
        "message": "WhatsApp Bulk Messaging Backend is running!"
    })


# ================= MOBILE VALIDATION =================

def validate_mobile_number(number):
    number = str(number).strip()

    if number.startswith("+91"):
        number = number[3:]
    elif number.startswith("91") and len(number) == 12:
        number = number[2:]

    if not re.fullmatch(r"[6-9]\d{9}", number):
        return None

    return "+91" + number


# ================= REGISTER API =================

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({
            "error": "Name, email and password are required."
        }), 400

    if len(password) < 8:
        return jsonify({
            "error": "Password must be at least 8 characters."
        }), 400

    password_hash = bcrypt.generate_password_hash(
        password
    ).decode("utf-8")

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO users (name, email, password_hash)
            VALUES (%s, %s, %s)
            """,
            (name, email, password_hash)
        )

        connection.commit()

        return jsonify({
            "message": "Registration successful!"
        }), 201

    except mysql.connector.IntegrityError:
        return jsonify({
            "error": "This email is already registered."
        }), 409

    except mysql.connector.Error:
        if connection and connection.is_connected():
            connection.rollback()

        app.logger.exception("Registration error")

        return jsonify({
            "error": "Registration failed."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ================= LOGIN API =================

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({
            "error": "Email and password are required."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, name, email, password_hash
            FROM users
            WHERE email = %s
            """,
            (email,)
        )

        user = cursor.fetchone()

        if not user or not bcrypt.check_password_hash(
            user["password_hash"], password
        ):
            return jsonify({
                "error": "Invalid email or password."
            }), 401

        return jsonify({
            "message": "Login successful!",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"]
            }
        }), 200

    except mysql.connector.Error:
        app.logger.exception("Login error")

        return jsonify({
            "error": "Login failed."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ================= CREATE CAMPAIGN API =================

@app.route("/api/campaigns", methods=["POST"])
def create_campaign():
    data = request.get_json(silent=True) or {}

    numbers = data.get("numbers", [])
    message = data.get("message", "").strip()

    if not isinstance(numbers, list) or not message:
        return jsonify({
            "error": "Please provide mobile numbers and message."
        }), 400

    if not numbers:
        return jsonify({
            "error": "Please enter at least one mobile number."
        }), 400

    valid_numbers = []
    invalid_numbers = []

    for number in numbers:
        validated = validate_mobile_number(number)

        if validated:
            if validated not in valid_numbers:
                valid_numbers.append(validated)
        else:
            invalid_numbers.append(str(number))

    if invalid_numbers:
        return jsonify({
            "error": "Some mobile numbers are invalid.",
            "invalid_numbers": invalid_numbers
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO campaigns
                (recipients, message, total_recipients, status)
            VALUES (%s, %s, %s, %s)
            """,
            (
                json.dumps(valid_numbers),
                message,
                len(valid_numbers),
                "Demo Prepared"
            )
        )

        connection.commit()
        campaign_id = cursor.lastrowid

        return jsonify({
            "message": "Demo campaign saved successfully.",
            "campaign": {
                "id": campaign_id,
                "recipients": valid_numbers,
                "message": message,
                "total_recipients": len(valid_numbers),
                "status": "Demo Prepared",
                "created_at": datetime.now().strftime(
                    "%d-%m-%Y %I:%M %p"
                )
            }
        }), 201

    except Exception:
        if connection and connection.is_connected():
            connection.rollback()

        app.logger.exception("Campaign creation error")

        return jsonify({
            "error": "Failed to save campaign."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ================= GET CAMPAIGNS API =================

@app.route("/api/campaigns", methods=["GET"])
def get_campaigns():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, recipients, message, total_recipients,
                   status, created_at
            FROM campaigns
            ORDER BY id DESC
        """)

        campaigns = cursor.fetchall()

        for campaign in campaigns:
            campaign["recipients"] = json.loads(
                campaign["recipients"]
            )

            if campaign["created_at"]:
                campaign["created_at"] = campaign[
                    "created_at"
                ].strftime("%d-%m-%Y %I:%M %p")

        return jsonify({"campaigns": campaigns})

    except Exception:
        app.logger.exception("Get campaigns error")

        return jsonify({
            "error": "Failed to fetch campaigns."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ================= CONTACTS: GET =================

@app.route("/api/contacts", methods=["GET"])
def get_contacts():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, name, mobile_number, created_at
            FROM contacts
            ORDER BY id DESC
        """)

        contacts = cursor.fetchall()

        for contact in contacts:
            if contact["created_at"]:
                contact["created_at"] = contact[
                    "created_at"
                ].strftime("%d-%m-%Y %I:%M %p")

        return jsonify({"contacts": contacts})

    except Exception:
        app.logger.exception("Get contacts error")
        return jsonify({"error": "Failed to fetch contacts."}), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ================= CONTACTS: IMPORT CSV =================

@app.route("/api/contacts/import", methods=["POST"])
def import_contacts():
    if "file" not in request.files:
        return jsonify({"error": "Please select a CSV file."}), 400

    uploaded_file = request.files["file"]

    if not uploaded_file.filename.lower().endswith(".csv"):
        return jsonify({"error": "Only CSV files are supported."}), 400

    try:
        content = uploaded_file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(content))

        if not reader.fieldnames:
            return jsonify({"error": "CSV file is empty."}), 400

        columns = {
            column.strip().lower(): column
            for column in reader.fieldnames
            if column
        }

        mobile_column = next(
            (
                columns[key]
                for key in (
                    "mobile_number", "mobile", "phone",
                    "phone_number", "number", "contact"
                )
                if key in columns
            ),
            None
        )

        name_column = next(
            (
                columns[key]
                for key in ("name", "full_name", "contact_name")
                if key in columns
            ),
            None
        )

        if not mobile_column:
            return jsonify({
                "error": (
                    "CSV must have a mobile_number, mobile, "
                    "phone, phone_number, number or contact column."
                )
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor()

        imported = 0
        duplicates = 0
        invalid = []

        for row in reader:
            raw_number = (row.get(mobile_column) or "").strip()
            name = (
                (row.get(name_column) or "").strip()
                if name_column else ""
            )

            number = validate_mobile_number(raw_number)

            if not number:
                invalid.append(raw_number)
                continue

            cursor.execute(
                """
                INSERT IGNORE INTO contacts
                    (mobile_number, name)
                VALUES (%s, %s)
                """,
                (number, name or None)
            )

            if cursor.rowcount == 1:
                imported += 1
            else:
                duplicates += 1

        connection.commit()

        return jsonify({
            "message": "CSV import completed.",
            "imported": imported,
            "duplicates": duplicates,
            "invalid_count": len(invalid),
            "invalid_numbers": invalid[:50]
        }), 200

    except UnicodeDecodeError:
        return jsonify({
            "error": "Please save the CSV file using UTF-8 encoding."
        }), 400

    except Exception:
        if "connection" in locals() and connection.is_connected():
            connection.rollback()

        app.logger.exception("CSV import error")

        return jsonify({"error": "CSV import failed."}), 500

    finally:
        if "cursor" in locals() and cursor:
            cursor.close()
        if "connection" in locals() and connection.is_connected():
            connection.close()


# ================= CREATE MESSAGE TEMPLATE =================

@app.route("/api/templates", methods=["POST"])
def create_template():
    data = request.get_json(silent=True) or {}

    template_name = data.get("template_name", "").strip()
    message = data.get("message", "").strip()

    if not template_name or not message:
        return jsonify({
            "error": "Template name and message are required."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO message_templates (template_name, message)
            VALUES (%s, %s)
            """,
            (template_name, message)
        )

        connection.commit()

        return jsonify({
            "message": "Template created successfully.",
            "id": cursor.lastrowid
        }), 201

    except Exception:
        if connection and connection.is_connected():
            connection.rollback()

        app.logger.exception("Create template error")
        return jsonify({"error": "Failed to create template."}), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ================= GET MESSAGE TEMPLATES =================

@app.route("/api/templates", methods=["GET"])
def get_templates():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, template_name, message, created_at, updated_at
            FROM message_templates
            ORDER BY id DESC
        """)

        templates = cursor.fetchall()

        for template in templates:
            for field in ("created_at", "updated_at"):
                if template[field]:
                    template[field] = template[field].strftime(
                        "%d-%m-%Y %I:%M %p"
                    )

        return jsonify({"templates": templates})

    except Exception:
        app.logger.exception("Get templates error")
        return jsonify({"error": "Failed to fetch templates."}), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ================= UPDATE MESSAGE TEMPLATE =================

@app.route("/api/templates/<int:template_id>", methods=["PUT"])
def update_template(template_id):
    data = request.get_json(silent=True) or {}

    template_name = data.get("template_name", "").strip()
    message = data.get("message", "").strip()

    if not template_name or not message:
        return jsonify({
            "error": "Template name and message are required."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE message_templates
            SET template_name = %s, message = %s
            WHERE id = %s
            """,
            (template_name, message, template_id)
        )

        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({
                "error": "Template not found or unchanged."
            }), 404

        return jsonify({"message": "Template updated successfully."})

    except Exception:
        if connection and connection.is_connected():
            connection.rollback()

        app.logger.exception("Update template error")
        return jsonify({"error": "Failed to update template."}), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ================= DELETE MESSAGE TEMPLATE =================

@app.route("/api/templates/<int:template_id>", methods=["DELETE"])
def delete_template(template_id):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            "DELETE FROM message_templates WHERE id = %s",
            (template_id,)
        )

        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "Template not found."}), 404

        return jsonify({"message": "Template deleted successfully."})

    except Exception:
        if connection and connection.is_connected():
            connection.rollback()

        app.logger.exception("Delete template error")
        return jsonify({"error": "Failed to delete template."}), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ================= DATABASE ANALYTICS =================

@app.route("/api/stats", methods=["GET"])
def get_stats():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                COUNT(*) AS total_campaigns,
                COALESCE(SUM(total_recipients), 0) AS total_recipients
            FROM campaigns
        """)

        stats = cursor.fetchone()

        cursor.execute("SELECT COUNT(*) AS total_contacts FROM contacts")
        contacts = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(*) AS total_templates
            FROM message_templates
        """)
        templates = cursor.fetchone()

        cursor.execute("""
            SELECT DATE(created_at) AS campaign_date,
                   COUNT(*) AS campaigns,
                   COALESCE(SUM(total_recipients), 0) AS recipients
            FROM campaigns
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(created_at)
            ORDER BY campaign_date
        """)

        daily_stats = cursor.fetchall()

        for item in daily_stats:
            item["campaign_date"] = item["campaign_date"].strftime("%Y-%m-%d")
            item["campaigns"] = int(item["campaigns"])
            item["recipients"] = int(item["recipients"])

        return jsonify({
            "total_campaigns": int(stats["total_campaigns"]),
            "total_recipients": int(stats["total_recipients"]),
            "messages_sent": 0,
            "total_contacts": int(contacts["total_contacts"]),
            "total_templates": int(templates["total_templates"]),
            "daily_stats": daily_stats,
            "note": "Messages are prepared only; actual WhatsApp delivery is not connected."
        })

    except Exception:
        app.logger.exception("Get stats error")
        return jsonify({"error": "Failed to fetch statistics."}), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ================= RUN SERVER =================

if __name__ == "__main__":
    app.run(debug=True, port=5000)
