import psycopg2
import sys
import boto3
import os
import requests
import xml.etree.ElementTree as ET
import time
import uuid
from datetime import date, timedelta

from dotenv import load_dotenv

load_dotenv()

# AWS
RDS_ENDPOINT=os.getenv("RDS_ENDPOINT")
RDS_PORT=os.getenv("RDS_PORT")
RDS_USERNAME=os.getenv("RDS_USERNAME")
RDS_REGION=os.getenv("RDS_REGION")
RDS_DBNAME=os.getenv("RDS_DBNAME")
RDS_PASSWORD=os.getenv("RDS_PASSWORD")
# Neon and other managed Postgres require TLS -> set DB_SSLMODE=require. Local: "disable".
DB_SSLMODE=os.getenv("DB_SSLMODE", "disable")

# LOCAL
LOCAL_ENDPOINT=os.getenv("LOCAL_ENDPOINT")
LOCAL_PORT=os.getenv("LOCAL_PORT")
LOCAL_USERNAME=os.getenv("LOCAL_USERNAME")
LOCAL_DBNAME=os.getenv("LOCAL_DBNAME")
LOCAL_PASSWORD=os.getenv("LOCAL_PASSWORD")

WTO_API_KEY=os.getenv("WTO_API_KEY")

def connect_postgres(local: bool=True):
    if local:
        return psycopg2.connect(host=LOCAL_ENDPOINT, port=LOCAL_PORT, database=LOCAL_DBNAME, user=LOCAL_USERNAME, password=LOCAL_PASSWORD)
    else:
        return psycopg2.connect(host=RDS_ENDPOINT, port=RDS_PORT, database=RDS_DBNAME, user=RDS_USERNAME, password=RDS_PASSWORD, sslmode=DB_SSLMODE)

def write_countries(new_data: dict[str, str], local=False):
    conn = connect_postgres(local)
    try:
        cur = conn.cursor()
        sql = """INSERT INTO country(code, name)
VALUES (%s, %s)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;"""
        for code, name in new_data.items():
            cur.execute(sql, (code, name))
        conn.commit()
    except Exception as e:
        print(f"Failed to insert countries", e)
    finally:
      conn.close()
    
def extract_country_codes_and_names(xml_content):
    """
    Extracts country codes and names from the given XML file.

    Args:
        xml_file (str): Path to the XML file.

    Returns:
        dict: A dictionary where the keys are country codes and the values are country names.
    """
    root = ET.fromstring(xml_content)

    # Define the namespace used in the XML file
    namespace = {
        'ns': 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message',
        'structure': 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure',
        'common': 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common'
    }

    # Find the Codelist with id="CL_COUNTRY_WITS"
    codelist = root.find(".//structure:Codelist[@id='CL_COUNTRY_WITS']", namespace)
    if codelist is None:
        print("Codelist with id 'CL_COUNTRY_WITS' not found.")
        return {}

    # Extract all country codes and names
    country_dict = {}
    for code in codelist.findall("structure:Code", namespace):
        code_id = code.attrib['id']
        if not code_id[0].isdigit():
            continue
        name_element = code.find("common:Name", namespace)
        country_name = name_element.text if name_element is not None else "Unknown"
        country_dict[code_id] = country_name

    return country_dict

def fetch_country_codes():
    """
    Fetches a dictionary of countries and their codes from the World Bank API.

    Returns:
        dict: A dictionary where the keys are country codes and the values are country names.
    """
    url = "https://wits.worldbank.org/API/V1/SDMX/V21/rest/codelist/all/"
    
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx and 5xx)
        return extract_country_codes_and_names(response.content)
    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}")
        return None

def parse_tariff_from_content(xml_content: bytes, origin_country: str, destination_country: str) -> dict[str, list[dict]]:
    """
    Parses the XML content and returns a dictionary of lists of tariff records grouped by product codes.

    Args:
        xml_content (bytes): XML content as bytes.
        origin_country (str): Origin country code.
        destination_country (str): Destination country code.

    Returns:
        dict[str, list[dict]]: Dictionary where keys are product codes and values are lists of tariff records.
    """
    root = ET.fromstring(xml_content)

    namespace = {
        'generic': 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic',
        'message': 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message'
    }

    records_by_product = {}
    series_list = root.findall(".//generic:Series", namespace)
    if not series_list:
        print("No series found in the XML content.")
        return records_by_product

    for series in series_list:
        product_code = series.find("generic:SeriesKey/generic:Value[@id='PRODUCTCODE']", namespace).attrib.get("value")
        if product_code not in records_by_product:
            records_by_product[product_code] = []

        for obs in series.findall("generic:Obs", namespace):
            time_period = obs.find("generic:ObsDimension[@id='TIME_PERIOD']", namespace).attrib.get("value")
            ad_valorem_rate = obs.find("generic:ObsValue", namespace).attrib.get("value")

            record = {
                "id": str(uuid.uuid4()),
                "originCountry": origin_country,
                "destinationCountry": destination_country,
                "effectiveDate": date(int(time_period), 1, 1),
                "expiryDate": None,  # Assuming no expiry date is provided in the XML
                "adValoremRate": float(ad_valorem_rate) * 0.01,
                "specificRate": 0.0,  # Assuming no specific rate is provided in the XML
                "minQuantity": 0,  # Assuming no minimum quantity is provided in the XML
                "maxQuantity": 0,  # Assuming no maximum quantity is provided in the XML
                "userDefined": False  # Assuming the record is not user-defined
            }
            records_by_product[product_code].append(record)

    return records_by_product

def fetch_tariff(origin, destination, products=["847130", "847170", "847330", "851712", "854231"]):
    url = "https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_Tariff_TRAINS/A.{destination}.{origin}.{product}.reported/?startperiod=1988&detail=dataOnly".format(origin=origin, destination=destination, product="+".join(products))
    
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx and 5xx)
        records = parse_tariff_from_content(response.content, origin, destination)
        return records
    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}")
        return None

def clean_tariff(records):
    result = []
    curr = records[0]
    # Sort the records list in place by effectiveDate
    records.sort(key=lambda x: x["effectiveDate"])
    for record in records[1:]:
        if not (record["adValoremRate"] == curr["adValoremRate"] and \
        record["specificRate"] == curr["specificRate"] and \
        record["minQuantity"] == curr["minQuantity"] and \
        record["maxQuantity"] == curr["maxQuantity"]):
            curr["expiryDate"] = record["effectiveDate"] - timedelta(days=1)
            result.append(curr)
            curr = record
    result.append(curr)
    return result

def write_tariff(record: dict, HTSCode: str, local=False) -> int:
    """
    Inserts a single tariff record into the database and returns the ID of the inserted record.

    Args:
        record (dict): A dictionary containing tariff record data.
        HTSCode (str): The product code associated with the tariff.

    Returns:
        int: The ID of the inserted record, or None if the insertion failed.
    """
    conn = connect_postgres(local)
    cur = conn.cursor()
    insert_sql = """INSERT INTO tariff(id, "origin_country_ode", "dest_country_code", "effectiv_date", "expiry_date", "ad_valorem_rate", "specific_rate", "min_quantity", "max_quantity", "user_defined", "enabled")
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
RETURNING id;"""  # Use RETURNING to fetch the ID of the inserted record

    search_sql = """SELECT * FROM public.tariff_product, public.tariff
WHERE public.tariff_product."tariff_id" = public.tariff.id
AND "origin_country_code" = %s 
AND "dest_country_code" = %s 
AND "effective_date" = %s 
AND "expiry_date" = %s 
AND "hts_code" = %s"""

    update_sql = """UPDATE tariff
SET
    "ad_valorem_rate" = %s,
    "specific_rate" = %s,
    "min_quantity" = %s,
    "max_quantity" = %s,
    "user_defined" = %s
WHERE
    "origin_country_code" = %s
    AND "dest_country_code" = %s
    AND "effective_date" = %s
    AND "expiry_date" = %s;
"""

    try:
        cur.execute(search_sql, (
            record["originCountry"],
            record["destinationCountry"],
            record["effectiveDate"],
            record["expiryDate"],
            HTSCode
        ))
        search_result = cur.fetchone()

        if search_result:
            cur.execute(update_sql, (
              record["adValoremRate"],
              record["specificRate"],
              record["minQuantity"],
              record["maxQuantity"],
              record["userDefined"],
              record["originCountry"],
              record["destinationCountry"],
              record["effectiveDate"],
              record["expiryDate"],
            ))
            conn.commit()
            return
      
        cur.execute(insert_sql, (
            str(record["id"]),
            record["originCountry"],
            record["destinationCountry"],
            record["effectiveDate"],
            record["expiryDate"],
            record["adValoremRate"],
            record["specificRate"],
            record["minQuantity"],
            record["maxQuantity"],
            record["userDefined"]
        ))

        # Fetch the ID of the inserted record
        inserted_id = cur.fetchone()
        if inserted_id:
            link_sql = """INSERT INTO tariff_product("hts_code", "tariff_id")
            VALUES (%s, %s)
            ON CONFLICT ("hts_code", "tariff_id") DO NOTHING"""
            cur.execute(link_sql, (HTSCode, inserted_id[0]))
            conn.commit()
        return inserted_id[0] if inserted_id else None
    except Exception as e:
        print(f"Failed to insert tariff record: {e}")
        return None
    finally:
        conn.close()

def scrape_from_wits():
    start_time = time.time()
    print("Retrieving country information")
    country_dict = fetch_country_codes()
    print("writing to db")
    write_countries(country_dict, True)
    print("Countries information saved to db\n")
    product_list = [
        "847330",
        "847170",
        "851712",
        "847130",
        "854231"
    ]
    # for origin_country_code in country_dict.keys():
    #     for destination_country_code in country_dict.keys():
    #         if (destination_country_code == "000"):
    #             continue
    #         if origin_country_code != destination_country_code:
    #             print(f"Fetching data [origin: {origin_country_code}, dest: {destination_country_code}]")
    #             records = fetch_tariff(origin_country_code, destination_country_code, product_list)
    #             if not records:
    #                 print("No records found")
    #                 continue
    #             for product_code in records:
    #                 tariffs = clean_tariff(records[product_code])
    #                 print(f"Wrting to db")
    #                 for r in tariffs:
    #                     write_tariff(r, product_code)
    #                 print(f"Saved tariff [origin: {origin_country_code}, dest: {destination_country_code}, prod: {product_code}]")
    # print(f"Program completed in {time.time() - start_time:.2f} seconds.")

def migrate_local_to_aws(overwrite = False):
    try:
        local_conn = connect_postgres(True)
        aws_conn = connect_postgres(False)

        cur = local_conn.cursor()
        sql = "SELECT * FROM country"
        cur.execute(sql)
        countries = cur.fetchall()

        sql = "SELECT * FROM tariff"
        cur.execute(sql)
        tariffs = cur.fetchall()

        sql = "SELECT * FROM product"
        cur.execute(sql)
        products = cur.fetchall()

        sql = "SELECT * FROM tariff_product"
        cur.execute(sql)
        tariff_product = cur.fetchall()

        cur = aws_conn.cursor()
        sql = """INSERT INTO country(code, name)
                VALUES (%s, %s)
                ON CONFLICT (code)"""
        if overwrite:
            sql += """ DO UPDATE
                SET name = EXCLUDED.name;"""
        else:
            sql += " DO NOTHING"
        for country in countries:
            cur.execute(sql, country)

        sql = """INSERT INTO product(hts_code, description, name, enabled)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (hts_code)"""
        if overwrite:
            sql += """ DO UPDATE
                SET 
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    enabled = EXCLUDED.enabled;"""
        else:
            sql += " DO NOTHING;"
        for product in products:
            cur.execute(sql, product)

        sql = """INSERT INTO tariff(id, origin_country_code, dest_country_code, effective_date, expiry_date, ad_valorem_rate, specific_rate, min_quantity, max_quantity, user_defined, enabled)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
                ON CONFLICT (id)"""
        if overwrite:
            sql += """ DO UPDATE
                SET 
                    origin_country_code = EXCLUDED.origin_country_code,
                    dest_country_code = EXCLUDED.dest_country_code,
                    effective_date = EXCLUDED.effective_date,
                    expiry_date = EXCLUDED.expiry_date,
                    ad_valorem_rate = EXCLUDED.ad_valorem_rate,
                    specific_rate = EXCLUDED.specific_rate,
                    min_quantity = EXCLUDED.min_quantity,
                    max_quantity = EXCLUDED.max_quantity,
                    user_defined = EXCLUDED.user_defined;"""
        else:
            sql += " DO NOTHING;"
        for tariff in tariffs:
            cur.execute(sql, tariff)

        sql = """INSERT INTO tariff_product(hts_code, tariff_id)
                VALUES (%s, %s)
                ON CONFLICT (hts_code, tariff_id)"""
        if overwrite:
            sql += """ DO UPDATE
                SET 
                    hts_code = EXCLUDED.hts_code,
                    tariff_id = EXCLUDED.tariff_id;"""
        else:
            sql += " DO NOTHING;"
        for tp in tariff_product:
            cur.execute(sql, tp)

        aws_conn.commit()
        print("Migration done and saved to AWS RDS instance")
    except:
        print(tariff)
    finally:
        local_conn.close()
        aws_conn.close()
    
if __name__ == "__main__":
    scrape_from_wits()