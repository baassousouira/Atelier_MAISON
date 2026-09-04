from fastapi import FastAPI

app = FastAPI()

etat_capteurs = {"luminosite": 0, "bouton": 0}

@app.get("/capteurs")
def lire_capteurs():
    return etat_capteurs