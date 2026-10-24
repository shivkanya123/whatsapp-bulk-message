
import mysql.connector

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="12345678",
        database="whatsapp_bulk_db"
    )


if __name__ == "__main__":
    try:
        connection = get_db_connection()

        if connection.is_connected():
            print("MySQL Database Connected Successfully!")

        connection.close()

    except mysql.connector.Error as error:
        print("Database Connection Error:", error)
