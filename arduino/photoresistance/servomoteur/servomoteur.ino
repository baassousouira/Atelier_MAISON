#include <Servo.h>  // on inclut la bibliothèque pour piloter un servomoteur

Servo monServo;  // on crée l'objet monServo

void setup()
{
    monServo.attach(9); // on définit le Pin utilisé par le servomoteur
}

void loop()
{
    for (int position = 0; position <=180; position ++){ // on crée une variable position qui prend des valeurs entre 0 à 180 degrés
        monServo.write(position);  // le bras du servomoteur prend la position de la variable position
        delay(15);  // on attend 15 millisecondes
    }

    for (int position = 180; position >=0; position --){ // cette fois la variable position passe de 180 à 0°
        monServo.write(position);  // le bras du servomoteur prend la position de la variable position
        delay(15);  // le bras du servomoteur prend la position de la variable position
    }
}