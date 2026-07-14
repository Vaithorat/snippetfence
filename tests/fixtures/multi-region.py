# @fence-begin "database-config"
DATABASE_URL = "postgresql://localhost:5432/mydb"
DATABASE_POOL_SIZE = 10
DATABASE_TIMEOUT = 30
# @fence-end

# Normal code below
import os
import sys

# @fence-begin
SECRET_KEY = "super-secret-key"
# @fence-end

def connect():
    pass
