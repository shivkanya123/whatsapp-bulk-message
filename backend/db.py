
import os
import mysql.connector


def get_db_connection():
    db_name = os.getenv("DB_NAME", "whatsapp_bulk_db")
    print("Database configured:", db_name)

    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "4000")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=db_name,
        ssl_verify_cert=True
    )


if __name__ == "__main__":
    try:
        connection = get_db_connection()
        print("MySQL Database Connected Successfully!")
        print("Connected database:", connection.database)
        connection.close()

    except mysql.connector.Error as error:
        print("Database Connection Error:", error)
