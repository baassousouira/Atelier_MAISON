// const int capteur = A0;     // photoresistance
// const int bouton = 4;       // bouton

// void setup() {
//   pinMode(bouton, INPUT);   // Bouton en entrée
//   Serial.begin(9600);       // Pour afficher l'alerte
// }

// void loop() {
//   int luminosite = analogRead(capteur);
//   float pourcentage = (luminosite / 1023.0) * 100.0;
  
//   int etatBouton = digitalRead(bouton);

//   Serial.print("{\"luminosite\":");
//   Serial.print(pourcentage);
//   Serial.print(",\"bouton\":");
//   Serial.print(etatBouton);
//   Serial.println("}");

//   delay(100);

// }

// -----------------------------------------------------------------------


const int PIN_PHOTORESISTANCE = A0;
const int PIN_BOUTON = 4;

float derniereLuminosite = 0.0;

// Variation minimale pour considérer un changement soudain
const float SEUIL_DELTA = 10.0;   // en pourcentage

void setup() {
  pinMode(PIN_BOUTON, INPUT);
  Serial.begin(9600);
}

void loop() {

  // 1) Lecture de la luminosité
  int luminositeBrute = analogRead(PIN_PHOTORESISTANCE);
  float pourcentage = (luminositeBrute / 1023.0) * 100.0;

  // 2) Calcul du delta
  float delta = abs(pourcentage - derniereLuminosite);

  // 3) Détection d’un changement soudain
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
