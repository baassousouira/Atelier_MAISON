#include "./capture.h"
#include "./mouvement.h"

#include <opencv2/opencv.hpp>
#include <iostream>
#include <chrono>
#include <sstream>

int main()
{
    cv::VideoCapture cap;

    // Pipeline GStreamer adapté à libcamera + OpenCV
    std::string pipeline =
        "libcamerasrc ! "
        "video/x-raw,width=640,height=480,format=NV12,framerate=30/1,colorimetry=bt709 ! "
        "videoconvert ! "
        "video/x-raw,format=BGR ! "
        "appsink drop=true max-buffers=1 sync=false";

    std::cout << "Ouverture de la camera..." << std::endl;

    cap.open(pipeline, cv::CAP_GSTREAMER);

    if (!cap.isOpened())
    {
        std::cerr << "ERREUR : impossible d'ouvrir la camera." << std::endl;
        return -1;
    }

    std::cout << "Camera ouverte." << std::endl;

    cv::Mat colorFrame;
    cv::Mat gray(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC1);
    cv::Mat motionMask(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC1);

    MotionBuffer mb;
    motion_init(
        mb,
        6,
        cv::Size(CAPTURE_WIDTH, CAPTURE_HEIGHT)
    );

    int threshold_pixel = 20;

    cv::namedWindow("capture", cv::WINDOW_AUTOSIZE);
    cv::namedWindow("mouvement", cv::WINDOW_AUTOSIZE);

    auto t_prev =
        std::chrono::high_resolution_clock::now();

    while (true)
    {
        // ------------------------------------------------
        // 1. CAPTURE
        // ------------------------------------------------

        if (!cap.read(colorFrame))
        {
            std::cerr << "Erreur lecture frame" << std::endl;
            break;
        }

        if (colorFrame.empty())
        {
            std::cerr << "Image vide recue." << std::endl;
            continue;
        }

        // ------------------------------------------------
        // 2. CONVERSION EN GRIS
        // ------------------------------------------------

        RGBtoBW(&colorFrame, &gray);

        // ------------------------------------------------
        // 3. DETECTION DU MOUVEMENT
        // ------------------------------------------------

        motion_push_gray(mb, gray);

        bool mask_ready =
            motion_compute_mask(
                mb,
                motionMask,
                threshold_pixel
            );

        // ------------------------------------------------
        // 4. BARYCENTRE
        // ------------------------------------------------

        cv::Point centroid =
            compute_centroid_keep_last(
                motionMask,
                mb
            );

        cv::Scalar meanRGB =
            compute_mean_rgb_keep_last(
                colorFrame,
                motionMask,
                mb
            );

        if (mask_ready)
        {
            draw_cross(
                colorFrame,
                centroid,
                cv::Scalar(0, 255, 0)
            );
        }

        // ------------------------------------------------
        // 5. FPS
        // ------------------------------------------------

        auto t_now =
            std::chrono::high_resolution_clock::now();

        double dt =
            std::chrono::duration_cast<
                std::chrono::microseconds
            >(t_now - t_prev).count() / 1000000.0;

        if (dt <= 0)
            dt = 0.000001;

        double fps = 1.0 / dt;

        t_prev = t_now;

        // ------------------------------------------------
        // 6. TEXTE RGB
        // ------------------------------------------------

        std::ostringstream oss_rgb;

        oss_rgb
            << "RGB mean: R="
            << int(meanRGB[0])
            << " G="
            << int(meanRGB[1])
            << " B="
            << int(meanRGB[2]);

        cv::putText(
            colorFrame,
            oss_rgb.str(),
            cv::Point(10, 30),
            cv::FONT_HERSHEY_SIMPLEX,
            0.7,
            cv::Scalar(0, 255, 255),
            2
        );

        // ------------------------------------------------
        // 7. TEXTE FPS
        // ------------------------------------------------

        std::ostringstream oss_fps;

        oss_fps
            << "FPS: "
            << int(fps);

        cv::putText(
            colorFrame,
            oss_fps.str(),
            cv::Point(10, 60),
            cv::FONT_HERSHEY_SIMPLEX,
            0.7,
            cv::Scalar(255, 255, 0),
            2
        );

        // ------------------------------------------------
        // 8. AFFICHAGE
        // ------------------------------------------------

        cv::imshow(
            "capture",
            colorFrame
        );

        cv::imshow(
            "mouvement",
            motionMask
        );

        // ESC pour quitter
        int key = cv::waitKey(1);

        if (key == 27)
            break;
    }

    cap.release();
    cv::destroyAllWindows();

    return 0;
}
