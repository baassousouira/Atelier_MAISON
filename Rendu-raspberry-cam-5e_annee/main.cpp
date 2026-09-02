#include "./capture.h"
#include "./mouvement.h"
#include <opencv2/opencv.hpp>
#include <sys/time.h>
#include <iostream>
#include <chrono>
#include <sstream>

int main() {
    cv::VideoCapture cap; //Objet OpenCV pour capture la vidéo 
    
    //Pipeline GStreamer pour configurer la caméra
    std::string pipeline =
        "libcamerasrc ! "
        "video/x-raw,width=640,height=480,format=RGB,framerate=30/1 ! "
        "videoconvert ! appsink";

    cap.open(pipeline, cv::CAP_GSTREAMER); //ouvre la caméra à partir de la pipeline
    open_capture(&cap);

	//Matrice OpenCV pour stocker les images
    cv::Mat colorFrame(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC3); //Image couleur RGB 8 bits x 3 canaux
    cv::Mat gray(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC1);       //Image en niveaux de gris (1 canal)
    cv::Mat motionMask(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC1); //masque binaire de la zone en mouvement

    // Initialisation du buffer de mouvement avec n = 6 (par exemple)
    MotionBuffer mb;
    motion_init(mb, 6, cv::Size(CAPTURE_WIDTH, CAPTURE_HEIGHT));
    int threshold_pixel = 20; // seuil de mouvement
 

    cv::namedWindow("capture", 1);    // Crée une fenêtre d'affichage pour l'image couleur annotée
    cv::namedWindow("mouvement", 1);  // Crée une fenêtre d'affichage pour le masque de mouvement
    // Trackbar pour ajuster en temps réel le seuil de détection de mouvement
    cv::createTrackbar("Seuil","mouvement",&threshold_pixel, 200);

	//temps de réference pour le calcul du FPS
    auto t_prev = std::chrono::high_resolution_clock::now();

    while (true) {
        // 1) Capture d'une image couleur
        capture_frame(&cap, &colorFrame);

        // 2) Conversion en niveaux de gris (RGB -> BW)
        RGBtoBW(&colorFrame, &gray);

        // 3) Mise à jour du buffer et calcul du masque de mouvement
        motion_push_gray(mb, gray);
        motion_compute_mask(mb, motionMask, threshold_pixel);

        // 4) Barycentre et moyenne RGB (avec stabilisation)
        cv::Point centroid = compute_centroid_keep_last(motionMask, mb); //Calcule la position du barycentre
        cv::Scalar meanRGB = compute_mean_rgb_keep_last(colorFrame, motionMask, mb); //Calcule la couleur moyenne

        // 5) Dessiner la croix sur le barycentre
        draw_cross(colorFrame, centroid, cv::Scalar(0, 255, 0)); // Croix verte à la pos du barycentre

        // 6) Calcul du FPS
        auto t_now = std::chrono::high_resolution_clock::now();
        double dt = std::chrono::duration_cast<std::chrono::microseconds>(t_now - t_prev).count() / 1e6;
        if (dt <= 0) dt = 1e-6;
        double fps = 1.0 / dt;
        t_prev = t_now;

        // 7) Affichage des infos texte (RGB et FPS)
        std::ostringstream oss_rgb;
        // meanRGB = (R,G,B)
        oss_rgb << "RGB mean: R=" << int(meanRGB[0])
                << " G=" << int(meanRGB[1])
                << " B=" << int(meanRGB[2]);
        cv::putText(colorFrame, oss_rgb.str(),
                    cv::Point(10, 30),
                    cv::FONT_HERSHEY_SIMPLEX, 0.7,
                    cv::Scalar(0, 255, 255), 2);

        std::ostringstream oss_fps;
        oss_fps << "FPS: " << int(fps);
        cv::putText(colorFrame, oss_fps.str(),
                    cv::Point(10, 60),
                    cv::FONT_HERSHEY_SIMPLEX, 0.7,
                    cv::Scalar(255, 255, 0), 2);

        // 8) Affichage
        cv::imshow("capture", colorFrame);
        cv::imshow("mouvement", motionMask);

        if (cv::waitKey(1) >= 0)
            break;
    }

    cap.release();
    cv::destroyAllWindows();
    return 0;
}
