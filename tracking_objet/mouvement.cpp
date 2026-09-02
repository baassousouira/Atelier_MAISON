#include "./mouvement.h"
#include "./capture.h"
#include <iostream>

/* premier test de capture et addition de frame mais une par une */
void initialisation(Mat *gris_precedente, Mat *cap_frame, VideoCapture *cap){
	capture_frame(cap, cap_frame);
	RGBtoBW(cap_frame, gris_precedente);
}

void soustraction_frame(Mat *gris, Mat *gris_precedente, Mat *diff){
	absdiff(*gris, *gris_precedente, *diff);
}


/*	Fonctions pour IR1/IR2 et barycentre */
void initialisation_ref(Mat *IR1_float, Mat *cap_frame, VideoCapture *cap, int n){
	if(n<1)n=1;
	
	capture_frame(cap, cap_frame);
	Mat gris(cap_frame->rows, cap_frame->cols, CV_8UC1);
	RGBtoBW(cap_frame, &gris);
	
	gris.convertTo(*IR1_float, CV_32FC1);
	
	for(int i=1; i<n; i++){
		capture_frame(cap, cap_frame);
		RGBtoBW(cap_frame, &gris);
		accumulation_image(&gris, IR1_float, i+1);
	}
	std::cout << "IR1 construite par moyenne de " << n << " images." << std::endl;
}

void accumulation_image(Mat *image_actuelle_gris, Mat *reference_float, int n){
	Mat current_float;
	image_actuelle_gris->convertTo(current_float, CV_32FC1);
	
	double alpha = 1.0/n;
	
	accumulateWeighted(current_float, *reference_float, alpha);
}

/*	Fonction pour soustraire IR2 et IR1 */
void soustraction_ref(Mat *IR1_float, Mat *IR2_float, Mat *diff_8bit){
	Mat diff_float; 
	absdiff(*IR1_float, *IR2_float, diff_float); 
	cv::convertScaleAbs(diff_float, *diff_8bit, 5.0); 
}

/* Fonctions de base de l'analyse de mouvement  */
int mask_mouvement(Mat *diff, Mat *mask){
    cv::threshold(*diff, *mask, 30, 255, cv::THRESH_BINARY);
	int count = 0;
	for(int y=0; y<mask->rows; y++){
		uchar* m = mask->ptr<uchar>(y);
		for(int x=0; x<mask->cols; x++){
			if(m[x] == 255) count++;
		}
	} 
    return count; 
}

void calcul_barycentre_mouvement(Mat *mask, double *bx, double *by) {
    long sumX = 0;
    long sumY = 0;
    long count = 0;

    for (int y = 0; y < mask->rows; y++) {
        const uchar* mask_row = mask->ptr<uchar>(y);
        for (int x = 0; x < mask->cols; x++) {
            if (mask_row[x] == 255) {
                sumX += x;
                sumY += y;
                count++;
            }
        }
    }

    if (count > 0) {
        *bx = (double)sumX / count;
        *by = (double)sumY / count;
    } else {
        *bx = -1.0;
        *by = -1.0;
    }
}

bool moyenne_couleur(Mat *frame, Mat *mask, double *mR, double *mG, double *mB){
	long sumR = 0, sumG = 0, sumB = 0;
	int count = 0;
	
	for(int y=0; y<mask->rows; y++){
		uchar* m = mask->ptr<uchar>(y);
		uchar* f = frame->ptr<uchar>(y);
		
		for(int x=0; x<mask->cols; x++){
			if(m[x]==255){
				sumR += f[x*3+0];
				sumG += f[x*3+1];
				sumB += f[x*3+2];
				count++;
			}
		}
	}
	if (count==0) return false;
	
	*mR = (double)sumR/count;
	*mG = (double)sumG/count;
	*mB = (double)sumB/count;
	
	return true;
}
