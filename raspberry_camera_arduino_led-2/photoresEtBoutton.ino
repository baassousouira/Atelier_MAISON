// photoresEtBoutton.ino
// -----------------------------------------------------------------------
// Détection par VARIATION SOUDAINE de luminosité (delta), plutôt qu'un
// seuil fixe : plus robuste face à un éclairage ambiant qui varie d'une
// pièce à l'autre ou d'un jour à l'autre.
//
// Rappel : la LED n'est PAS sur cet Arduino (elle est câblée sur le
// Raspberry), donc cet Arduino n'a qu'un travail : envoyer les
// événements en JSON par le port série.
// -----------------------------------------------------------------------

const int PIN_PHOTORESISTANCE = A0;
const int PIN_BOUTON = 4;

float derniereLuminosite = 0.0;

// Variation minimale pour considérer un changement soudain (en pourcentage)
const float SEUIL_DELTA = 10.0;

void setup() {
  pinMode(PIN_BOUTON, INPUT);
  Serial.begin(9600);

  // CORRECTIF : on prend une première mesure réelle ici, AVANT la boucle,
  // pour que "derniereLuminosite" parte de la vraie valeur ambiante.
  // Sans ça, elle démarre à 0.0, et le tout premier calcul de delta dans
  // loop() déclenche presque toujours une fausse alerte au démarrage
  // (la luminosité réelle est quasiment toujours à plus de 10% de 0.0).
  int luminositeBrute = analogRead(PIN_PHOTORESISTANCE);
  derniereLuminosite = (luminositeBrute / 1023.0) * 100.0;
}

void loop() {

  // 1) Lecture de la luminosité
  int luminositeBrute = analogRead(PIN_PHOTORESISTANCE);
  float pourcentage = (luminositeBrute / 1023.0) * 100.0;

  // 2) Calcul du delta
  float delta = abs(pourcentage - derniereLuminosite);

  // 3) Détection d'un changement soudain
  if (delta > SEUIL_DELTA) {
    Serial.print("{\"capteur\":\"photoresistance\",\"valeur\":");
    Serial.print(pourcentage);
    Serial.print(",\"variation\":");
    Serial.print(delta);
    Serial.println("}");
  }

  // Mise à jour de la dernière valeur
  derniereLuminosite = pourcentage;

  // 4) Détection du bouton (inchangé)
  int etatBouton = digitalRead(PIN_BOUTON);
  static int dernierEtatBouton = LOW;

  if (etatBouton == HIGH && dernierEtatBouton == LOW) {
    Serial.println("{\"capteur\":\"bouton\",\"valeur\":1}");
  }

  dernierEtatBouton = etatBouton;

  delay(100);
}
