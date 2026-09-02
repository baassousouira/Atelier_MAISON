// mouvement.h (CORRIGÉ)

#ifndef __MOUVEMENT_H
#define __MOUVEMENT_H

#include <opencv2/opencv.hpp>
#include <iostream>

using namespace cv;

/* Anciennes fonctions  */
void initialisation(Mat *gris_precedente, Mat *cap_frame, VideoCapture *cap); // Old one
void soustraction_frame(Mat *gris, Mat *gris_precedente, Mat *diff); // Old one

/* Fonctions pour IR1/IR2 et barycentre */
void initialisation_ref(Mat *IR1_float, Mat *cap_frame, VideoCapture *cap, int n);
void accumulation_image(Mat *image_actuelle_gris, Mat *reference_float, int n);

// La soustraction des références IR2 et IR1
void soustraction_ref(Mat *IR1_float, Mat *IR2_float, Mat *diff_8bit); 

/* Fonctions de base de l'analyse de mouvement */
int mask_mouvement(Mat *diff, Mat *mask);
void calcul_barycentre_mouvement(Mat *mask, double *bx, double *by);
bool moyenne_couleur(Mat *frame, Mat *mask, double *mR, double *mG, double *mB);

#endif /* __MOUVEMENT_H*/
