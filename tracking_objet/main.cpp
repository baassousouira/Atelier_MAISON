#include "./capture.h"
#include "./mouvement.h"
#include <opencv2/opencv.hpp>
#include <sys/time.h>
#include <iostream>
#include <iomanip>

using namespace cv;
using namespace std;

#define SEUIL_MINIMAL 100
#define N_ACCUMULATION 6

int main(int, char**)
{
    /*ALLOCATION*/
    Mat frame;
    /* plus utilisée -> utile pour reddetect */
	//Mat result(CAPTURE_HEIGHT,CAPTURE_WIDTH,CV_8UC1);
    
    Mat gris(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC1);
    
    Mat IR1_float(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_32FC1); 
    Mat IR2_float(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_32FC1);
    
    Mat diff(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC1);
    Mat mask(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC1);
    
    // Variables de tracking et de stabilité
    double bx=0.0, by=0.0;
    double mR=0.0, mG=0.0, mB=0.0;
    
    // Variables pour la stabilité (mémoire du dernier focus)
    double dernier_bx = CAPTURE_WIDTH / 2.0;
    double dernier_by = CAPTURE_HEIGHT / 2.0;
    double dernier_mR = 0.0, dernier_mG = 0.0, dernier_mB = 0.0;
    
    double total_duration = 0.0;
    int frame_count = 0;
    time_t last_average_time = time(NULL);
    const int AVERAGE_INTERVAL_SEC = 20; // Intervalle de 20 secondes

    string pipeline=
                "libcamerasrc ! "
                "video/x-raw,width=640,height=480,format=RGB,framerate=30/1 ! "
                "videoconvert ! "
                "appsink";
 
    VideoCapture cap(pipeline,cv::CAP_GSTREAMER);

    open_capture(&cap);
    namedWindow("capture",1);
    namedWindow("diff",1);
    
    initialisation_ref(&IR1_float, &frame, &cap, N_ACCUMULATION);
    IR1_float.copyTo(IR2_float); // IR2 commence comme IR1
    
    /*LOOP*/
    struct timeval tv1, tv2;
    
    while(1){
        gettimeofday(&tv1, NULL);
        
        capture_frame(&cap,&frame);
        RGBtoBW(&frame, &gris);
        
        /* plus utilisée -> utile pour reddetect */
        //detect_red(&frame, &result);
        //barycentre_red(&result);
        
        accumulation_image(&gris, &IR2_float, N_ACCUMULATION);
        soustraction_ref(&IR1_float, &IR2_float, &diff);
        
        int nbPixels = mask_mouvement(&diff, &mask);

        if(nbPixels > SEUIL_MINIMAL){ // Mouvement détecté
            
            // Calcul du Barycentre et de la Couleur pour la zone en mouvement
            calcul_barycentre_mouvement(&mask, &bx, &by);
            moyenne_couleur(&frame, &mask, &mR, &mG, &mB);

            // Mémorisation du Focus et de la Couleur
            dernier_bx = bx;
            dernier_by = by;
            dernier_mR = mR;
            dernier_mG = mG;
            dernier_mB = mB;
        }

        // Affichage du focus actuel ou mémorisé (pour la stabilité)
        if(dernier_bx > 0){ // Si un focus valide a déjà été trouvé
            // Dessiner le focus (un cercle ou une croix) sur la frame
            circle(frame, Point((int)dernier_bx, (int)dernier_by), 10, Scalar(0, 0, 255), 2);
            
            // Affichage des informations
            cout << "\rFocus RGB: "
                 << (int)dernier_mR << " "
                 << (int)dernier_mG << " "
                 << (int)dernier_mB 
                 << " (" << (int)dernier_bx << "," << (int)dernier_by << ")" << flush;
        } else {
            cout << "\rEn attente de mouvement..." << flush;
        }

        // Mise à jour de la Référence IR1 (pour l'itération suivante)
        // IR1 prend la place de IR2 pour la prochaine soustraction
        IR2_float.copyTo(IR1_float);

        // Mesure du Temps (Fin de la boucle)
        gettimeofday(&tv2, NULL); // Fin de l'itération
        double duration = (tv2.tv_sec - tv1.tv_sec) + (tv2.tv_usec - tv1.tv_usec) / 1000000.0;
        double fps = 1.0 / duration;
        
        total_duration += duration;
        frame_count++;
        
        time_t current_time = time(NULL);
        if (current_time - last_average_time >= AVERAGE_INTERVAL_SEC) {
            if (frame_count > 0) {
                double average_fps = (double)frame_count / total_duration;
                cout << "\n--- Moyenne FPS (" << AVERAGE_INTERVAL_SEC << "s): " 
                     << fixed << setprecision(1) << average_fps << " fps ---\n" << flush;
            }
            
            // Réinitialisation pour la prochaine période
            total_duration = 0.0;
            frame_count = 0;
            last_average_time = current_time;
        }
        
        cout << " / FPS: " << fixed << setprecision(1) << fps << flush;

        // Affichage des fenêtres
        imshow("capture", frame);
        imshow("diff", diff);

        if(waitKey(1) == 27) break;
   }
}

