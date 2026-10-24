
import os
import mysql.connector

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME", "whatsapp_bulk_db")
    )

if __name__ == "__main__":
    try:
        connection = get_db_connection()

        if connection.is_connected():
            print("MySQL Database Connected Successfully!")

        connection.close()

    except mysql.connector.Error as error:
        print("Database Connection Error:", error)
