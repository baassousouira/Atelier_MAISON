// mouvement.h
// -----------------------------------------------------------------------
// Ce fichier déclare la logique de détection de mouvement par différence
// d'images (on compare la moyenne des "n" images les plus anciennes à la
// moyenne des "n" images les plus récentes, puis on seuille la différence).
// C'est le code fourni au départ, non modifié : main.cpp l'utilise pour
// savoir SI et OÙ il y a du mouvement, avant de décider de déclencher
// une alerte (voir la machine à états dans main.cpp).
// -----------------------------------------------------------------------
#ifndef MOUVEMENT_H
#define MOUVEMENT_H
#define MOTION_AREA_MIN 300 //nombre minimal de pixels pour valider un mouvement

#include <opencv2/opencv.hpp>
#include <iostream>
#include <stdio.h>

using namespace cv;

//Strucrure pour gérer lhistorique et la stabilisation 
struct MotionBuffer {
    int n;                  // nombre d'images par IR
    int idx;                // indice circulaire
    int count;              // nombre d'images stockées
    cv::Mat *grayBuf;       // buffer d'images gris
    cv::Mat IR1;            // somme des premières n images
    cv::Mat IR2;            // somme des dernières n images
    cv::Point lastCentroid; // dernier barycentre connu
    cv::Scalar lastMeanRGB; // dernière moyenne RGB connue
    bool sums_initialized;  // <-- AJOUT IMPORTANT
};


//Initialisation
void motion_init(MotionBuffer &mb, int n, cv::Size frameSize);

//Ajouter une image grise au buffer
void motion_push_gray(MotionBuffer &mb, const cv::Mat &gray);

//Calculer le masque de mouvement
bool motion_compute_mask(MotionBuffer &mb, cv::Mat &mask, int threshold_pixel);

//Calcul du barycentre (qui garde le dernier s'il n'y a aucun mouvement)
cv::Point compute_centroid_keep_last(const cv::Mat &mask, MotionBuffer &mb);

//Calcul de la moyenne RGB sur la zone de mouvement 
cv::Scalar compute_mean_rgb_keep_last(const cv::Mat &colorFrame, const cv::Mat &mask, MotionBuffer &mb);

//Dessiner une croix
void draw_cross(cv::Mat &img, cv::Point p, cv::Scalar color=cv::Scalar(0,255,0));

#endif /* MOUVEMENT_H*/
