# Serveur (FastAPI + SQLite)

Prévu pour tourner sur la machine à l'adresse **192.168.1.1**, port **8000**.

## Installation

```bash
python3 -m venv venv
source venv/bin/activate        # sous Windows : venv\Scripts\activate
pip install -r requirements.txt
```

## Lancement

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

(ou plus simplement `python main.py`, ça revient au même)

Le fichier `evenements.db` (la base SQLite) se crée automatiquement au
premier lancement, à côté de `main.py`.

## Vérifier que ça marche

1. Ouvrez `http://192.168.1.1:8000/` dans un navigateur (depuis
   n'importe quel appareil du même réseau, ex. le 192.168.1.5) : vous
   devez voir la page avec le titre "Surveillance à domicile".
2. Testez manuellement l'envoi d'un événement, par exemple avec `curl` :

```bash
curl -X POST http://192.168.1.1:8000/api/evenements \
  -H "Content-Type: application/json" \
  -d '{"capteur":"camera_fixe","zone":"salon","horodatage":1234567890}'
```

3. Rechargez la page web : le pop-up d'alerte doit apparaître avec les
   informations de cet événement.
4. Cliquez sur "Fausse alerte" ou "Vraie alerte" : l'événement doit
   passer dans l'historique avec le bon statut.

## Endpoints disponibles

| Méthode | URL | Usage |
|---|---|---|
| POST | `/api/evenements` | un Raspberry signale un événement |
| GET | `/api/evenements/{id}/decision` | un Raspberry demande la décision prise |
| POST | `/api/evenements/{id}/decision` | l'app/le site envoie la décision |
| GET | `/api/evenements` | liste de l'historique (filtrable avec `?decision=en_attente`) |
| DELETE | `/api/evenements/{id}` | supprime un événement |
| DELETE | `/api/evenements` | vide tout l'historique |

## Ce qui reste volontairement simple (à adapter plus tard)

- Pas d'authentification pour l'instant (n'importe qui sur le réseau
  local peut répondre aux alertes) — à ajouter avant un vrai déploiement
- SQLite plutôt que MySQL/PostgreSQL — suffisant pour ce prototype, sans
  serveur de base de données à installer
- Le pop-up ne gère qu'un événement à la fois (le plus récent) — s'il y
  a plusieurs alertes simultanées, il faudra prévoir une file d'attente
