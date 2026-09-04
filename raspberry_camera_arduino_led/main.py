# main.py
# -----------------------------------------------------------------------
# Serveur central du projet (IP prévue : 192.168.1.1, port 8000).
#
# Ce serveur fait 3 choses :
#   1. Il reçoit les événements envoyés par les Raspberry (ex: "mouvement
#      détecté par la caméra fixe") et les stocke dans une base SQL.
#   2. Il sert une petite page web (index.html) qui affiche un pop-up
#      dès qu'un événement arrive, avec 2 boutons "fausse alerte" /
#      "vraie alerte".
#   3. Il renvoie aux Raspberry la décision prise sur cette page, pour
#      qu'ils puissent piloter leur LED en conséquence.
#
# Choix technique : on utilise SQLite (le module "sqlite3", livré avec
# Python, pas d'installation supplémentaire) plutôt que MySQL/PostgreSQL.
# C'est un choix de RAPIDITÉ pour ce prototype : aucune base de données
# à installer/configurer, tout est dans un simple fichier "evenements.db"
# à côté de ce script. Si besoin plus tard, on pourra migrer vers un
# vrai serveur SQL sans changer la logique (seules les requêtes SQL
# resteraient identiques ou très proches).
# -----------------------------------------------------------------------

import sqlite3          # pour parler à notre base de données SQL
import time               # pour l'horodatage (date/heure actuelle)
import uuid                # pour générer un identifiant unique par événement
from pathlib import Path    # pour manipuler des chemins de fichiers proprement

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel  # pour décrire/valider automatiquement le format des requêtes


# =========================================================================
# CONFIGURATION
# =========================================================================

# Chemin du fichier de base de données SQLite (créé automatiquement s'il
# n'existe pas encore, juste à côté de ce script)
CHEMIN_BASE = Path(__file__).parent / "evenements.db"

# Dossier contenant la page web (index.html, éventuellement CSS/JS séparés)
DOSSIER_STATIC = Path(__file__).parent / "static"


# =========================================================================
# INITIALISATION DE LA BASE DE DONNÉES
# =========================================================================

def get_connexion():
    """
    Ouvre une connexion à la base SQLite.
    On en ouvre une NOUVELLE à chaque appel (plutôt qu'une connexion
    globale partagée) : c'est la façon recommandée d'utiliser sqlite3
    avec FastAPI, pour éviter les soucis d'accès concurrent entre
    plusieurs requêtes qui arriveraient en même temps.
    """
    connexion = sqlite3.connect(CHEMIN_BASE)
    # Permet d'accéder aux colonnes par leur NOM (ex: ligne["capteur"])
    # plutôt que par leur numéro (ligne[0], ligne[1]...), plus lisible.
    connexion.row_factory = sqlite3.Row
    return connexion


def initialiser_base():
    """
    Crée la table "evenements" si elle n'existe pas déjà.
    Appelée une seule fois au démarrage du serveur.
    """
    connexion = get_connexion()
    connexion.execute("""
        CREATE TABLE IF NOT EXISTS evenements (
            id TEXT PRIMARY KEY,           -- identifiant unique (généré avec uuid)
            capteur TEXT NOT NULL,         -- ex: "camera_fixe", "bouton", "photoresistance"...
            zone TEXT NOT NULL,            -- ex: "salon", "entree"...
            horodatage INTEGER NOT NULL,   -- date/heure de la détection (timestamp Unix)
            decision TEXT NOT NULL DEFAULT 'en_attente',  -- 'en_attente' / 'fausse_alerte' / 'vraie_alerte'
            horodatage_decision INTEGER    -- date/heure de la décision (NULL tant qu'on attend)
        )
    """)
    connexion.commit()  # on valide la création de la table
    connexion.close()


# =========================================================================
# FORMAT DES DONNÉES ATTENDUES/RENVOYÉES (validation automatique par FastAPI)
# =========================================================================

class NouvelEvenement(BaseModel):
    """
    Format attendu quand un Raspberry envoie un nouvel événement.
    FastAPI vérifie AUTOMATIQUEMENT que le JSON reçu correspond à ce
    format (types corrects, champs obligatoires présents...). Si ce
    n'est pas le cas, il renvoie une erreur 422 explicite tout seul,
    sans qu'on ait à écrire de code de validation nous-mêmes.
    """
    capteur: str
    zone: str
    horodatage: int


class Decision(BaseModel):
    """Format attendu quand l'app/le site web envoie sa décision."""
    decision: str  # doit valoir "fausse_alerte" ou "vraie_alerte"


# =========================================================================
# CRÉATION DE L'APPLICATION FASTAPI
# =========================================================================

app = FastAPI(title="Serveur de surveillance à domicile")

# Au tout premier démarrage du serveur, on s'assure que la table existe
initialiser_base()

# On "monte" le dossier static pour que les fichiers qu'il contient
# (index.html, éventuellement style.css, script.js...) soient accessibles
# directement par le navigateur, à l'adresse /static/...
app.mount("/static", StaticFiles(directory=DOSSIER_STATIC), name="static")


@app.get("/")
def page_accueil():
    """
    Page d'accueil : on renvoie directement index.html.
    C'est CETTE page que vous ouvrez dans un navigateur à l'adresse
    http://192.168.1.1:8000/ pour voir le pop-up d'alerte.
    """
    return FileResponse(DOSSIER_STATIC / "index.html")


# =========================================================================
# ROUTE 1 : un Raspberry signale un nouvel événement
# =========================================================================

@app.post("/api/evenements")
def creer_evenement(evenement: NouvelEvenement):
    """
    Appelée par un Raspberry (via network.cpp côté C++) quand il détecte
    quelque chose (mouvement, bouton pressé, etc.).
    On enregistre l'événement en base avec le statut "en_attente", et on
    renvoie un identifiant unique que le Raspberry réutilisera pour
    savoir plus tard ce qui a été décidé.
    """
    identifiant = str(uuid.uuid4())  # génère un identifiant unique, ex: "3fa85f64-5717-..."

    connexion = get_connexion()
    connexion.execute(
        """
        INSERT INTO evenements (id, capteur, zone, horodatage, decision)
        VALUES (?, ?, ?, ?, 'en_attente')
        """,
        (identifiant, evenement.capteur, evenement.zone, evenement.horodatage),
        # Note : on utilise des "?" plutôt que d'insérer directement les
        # valeurs dans la chaîne SQL. C'est essentiel pour la sécurité
        # (ça évite les injections SQL) — sqlite3 s'occupe lui-même
        # d'échapper correctement chaque valeur.
    )
    connexion.commit()
    connexion.close()

    print(f"[serveur] nouvel événement reçu : {evenement.capteur} / {evenement.zone} (id={identifiant})")

    # On renvoie l'identifiant : c'est ce que network.cpp (côté Raspberry)
    # attend dans le champ "id" de la réponse JSON
    return {"id": identifiant}


# =========================================================================
# ROUTE 2 : un Raspberry demande "où en est ma décision ?"
# =========================================================================

@app.get("/api/evenements/{identifiant}/decision")
def lire_decision(identifiant: str):
    """
    Appelée en boucle par le Raspberry (poll_decision côté C++) tant
    que personne n'a répondu depuis l'app/le site web.
    """
    connexion = get_connexion()
    ligne = connexion.execute(
        "SELECT decision FROM evenements WHERE id = ?",
        (identifiant,)
    ).fetchone()
    connexion.close()

    if ligne is None:
        # L'identifiant n'existe pas en base : on renvoie une erreur HTTP 404
        raise HTTPException(status_code=404, detail="événement introuvable")

    return {"decision": ligne["decision"]}


# =========================================================================
# ROUTE 3 : l'app/le site web envoie sa décision
# =========================================================================

@app.post("/api/evenements/{identifiant}/decision")
def repondre_evenement(identifiant: str, reponse: Decision):
    """
    Appelée par la page web (index.html) quand l'utilisateur clique sur
    "fausse alerte" ou "vraie alerte" dans le pop-up.
    """
    # On vérifie que la valeur envoyée est bien l'une des deux attendues,
    # pour éviter d'enregistrer n'importe quoi en base par erreur
    if reponse.decision not in ("fausse_alerte", "vraie_alerte"):
        raise HTTPException(
            status_code=422,
            detail="decision doit être 'fausse_alerte' ou 'vraie_alerte'"
        )

    connexion = get_connexion()

    # On vérifie d'abord que l'événement existe
    ligne = connexion.execute(
        "SELECT id FROM evenements WHERE id = ?", (identifiant,)
    ).fetchone()

    if ligne is None:
        connexion.close()
        raise HTTPException(status_code=404, detail="événement introuvable")

    # On met à jour la décision et l'horodatage de la décision
    connexion.execute(
        """
        UPDATE evenements
        SET decision = ?, horodatage_decision = ?
        WHERE id = ?
        """,
        (reponse.decision, int(time.time()), identifiant),
    )
    connexion.commit()
    connexion.close()

    print(f"[serveur] décision reçue pour {identifiant} : {reponse.decision}")

    return {"ok": True}


# =========================================================================
# ROUTE 4 : lister les événements (utilisée par la page web)
# =========================================================================

@app.get("/api/evenements")
def lister_evenements(decision: str | None = None):
    """
    Renvoie la liste des événements, du plus récent au plus ancien.
    - Sans paramètre : renvoie TOUT l'historique (utilisé pour la liste
      affichée en bas de la page)
    - Avec ?decision=en_attente : ne renvoie QUE les événements pas
      encore traités (utilisé par le pop-up pour savoir s'il doit
      s'afficher)

    Exemple d'appel : GET /api/evenements?decision=en_attente
    """
    connexion = get_connexion()

    if decision is not None:
        lignes = connexion.execute(
            "SELECT * FROM evenements WHERE decision = ? ORDER BY horodatage DESC",
            (decision,)
        ).fetchall()
    else:
        lignes = connexion.execute(
            "SELECT * FROM evenements ORDER BY horodatage DESC"
        ).fetchall()

    connexion.close()

    # On convertit chaque ligne SQL en dictionnaire Python classique,
    # pour que FastAPI puisse le transformer automatiquement en JSON
    return [dict(ligne) for ligne in lignes]


# =========================================================================
# ROUTE 5 : supprimer un événement précis (bouton "supprimer" côté app)
# =========================================================================

@app.delete("/api/evenements/{identifiant}")
def supprimer_evenement(identifiant: str):
    connexion = get_connexion()
    connexion.execute("DELETE FROM evenements WHERE id = ?", (identifiant,))
    connexion.commit()
    connexion.close()
    return {"ok": True}


# =========================================================================
# ROUTE 6 : vider tout l'historique (bouton "vider l'historique")
# =========================================================================

@app.delete("/api/evenements")
def vider_historique():
    connexion = get_connexion()
    connexion.execute("DELETE FROM evenements")
    connexion.commit()
    connexion.close()
    return {"ok": True}


# =========================================================================
# Pour lancer le serveur directement avec "python main.py"
# (sinon on peut aussi utiliser : uvicorn main:app --host 0.0.0.0 --port 8000)
# =========================================================================
if __name__ == "__main__":
    import uvicorn
    # host="0.0.0.0" : le serveur écoute sur TOUTES les interfaces réseau
    # du Raspberry/PC, pas seulement "localhost" — c'est indispensable
    # pour que les autres appareils du réseau (192.168.1.4, 192.168.1.5...)
    # puissent le joindre.
    uvicorn.run(app, host="0.0.0.0", port=8000)
