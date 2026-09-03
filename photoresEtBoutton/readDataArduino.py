import serial
import json

ser = serial.Serial('/dev/ttyACM0', 9600)

while True:
    ligne = ser.readline().decode().strip()
    try:
        data = json.loads(ligne)
        print(data)
    except:
        pass
