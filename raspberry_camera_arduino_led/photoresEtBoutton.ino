// photoresEtBoutton.ino
// -----------------------------------------------------------------------
// Lecture du bouton et de la photorésistance, avec détection par
// ÉVÉNEMENT (pas d'envoi en continu, seulement quand quelque chose
// de nouveau se passe).
//
// IMPORTANT : contrairement à une version précédente envisagée, la LED
// d'acquittement n'est PAS sur cet Arduino — elle est câblée directement
// sur le Raspberry (confirmé par votre montage photo), qui la pilote
// lui-même. Cet Arduino n'a donc qu'un seul travail : lire les capteurs
// et envoyer les événements en JSON par le port série. Rien à recevoir
// en retour.
// -----------------------------------------------------------------------

const int PIN_PHOTORESISTANCE = A0;  // capteur analogique
const int PIN_BOUTON = 4;             // capteur numérique

// Seuil de déclenchement pour la photorésistance, en pourcentage de
// luminosité. À CALIBRER selon votre pièce/éclairage réel : faites un
// test, notez la valeur "normale" affichée, et fixez ce seuil un peu
// en dessous.
const float SEUIL_LUMINOSITE = 15.0;

// On mémorise l'état précédent de chaque capteur pour ne détecter que
// les TRANSITIONS (le moment où ça change), pas un état qui perdure.
// Sans ça, tant que le bouton reste enfoncé ou que la pièce reste
// sombre, on enverrait un événement toutes les 100ms en boucle.
int dernierEtatBouton = LOW;
bool luminositeEtaitSuspecte = false;

void setup() {
  pinMode(PIN_BOUTON, INPUT);
  Serial.begin(9600);
}

void loop() {

  // ---------------------------------------------------------------
  // 1) LECTURE DES CAPTEURS
  // ---------------------------------------------------------------
  int luminositeBrute = analogRead(PIN_PHOTORESISTANCE);
  float pourcentage = (luminositeBrute / 1023.0) * 100.0;
  int etatBouton = digitalRead(PIN_BOUTON);

  // ---------------------------------------------------------------
  // 2) DÉTECTION DES ÉVÉNEMENTS (transitions uniquement)
  // ---------------------------------------------------------------

  // Bouton : on ne signale que le moment où il passe de relâché à pressé
  bool boutonVientDetrePresse = (etatBouton == HIGH && dernierEtatBouton == LOW);
  dernierEtatBouton = etatBouton;

  // Photorésistance : on ne signale que le moment où la luminosité
  // passe SOUS le seuil (pas tant qu'elle y reste)
  bool luminositeSuspecteMaintenant = (pourcentage < SEUIL_LUMINOSITE);
  bool luminositeVientDeDevenirSuspecte = (luminositeSuspecteMaintenant && !luminositeEtaitSuspecte);
  luminositeEtaitSuspecte = luminositeSuspecteMaintenant;

  // ---------------------------------------------------------------
  // 3) ENVOI DES ÉVÉNEMENTS AU RASPBERRY (format JSON, une ligne par événement)
  // ---------------------------------------------------------------
  // Le Raspberry (main.cpp, via arduino.cpp) lit ces lignes en série et
  // les traite exactement comme un événement caméra : envoi au serveur,
  // attente de la décision, puis c'est LUI qui pilote la LED.
  if (boutonVientDetrePresse) {
    Serial.println("{\"capteur\":\"bouton\"}");
  }

  if (luminositeVientDeDevenirSuspecte) {
    Serial.print("{\"capteur\":\"photoresistance\",\"valeur\":");
    Serial.print(pourcentage);
    Serial.println("}");
  }

  delay(100);
}
