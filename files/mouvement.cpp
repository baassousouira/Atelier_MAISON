#include "mouvement.h"
#include <opencv2/opencv.hpp>
using namespace cv;

/********************************************************************
- INITIALISATION DU BUFFER DE MOUVEMENT
********************************************************************/
void motion_init(MotionBuffer &mb, int n, Size frameSize)
{
    if (n < 1) n = 1; //On force n à être au minimum 1
    if (n > 12) n = 12; //On force n à être au maximm 12

    mb.n = n; //Dauvergarde de la taille de fenetre temporelle
    mb.idx = 0; //Index d'écriture dans le buffer circulaire
    mb.count = 0; //Nombre d'iamges effectivement stckées pour l'insatnt

    int B = 2 * n;

    // Allocation des images gris dans un buffer circulaire
    mb.grayBuf = new Mat[B];
    for (int i = 0; i < B; i++)
        mb.grayBuf[i] = Mat(frameSize, CV_8UC1, Scalar(0));

    // Sommes IR1 et IR2 (CV_32S)
    mb.IR1 = Mat(frameSize, CV_32S, Scalar(0));
    mb.IR2 = Mat(frameSize, CV_32S, Scalar(0));

    mb.lastCentroid = Point(frameSize.width / 2, frameSize.height / 2);
    mb.lastMeanRGB = Scalar(0, 0, 0);
    mb.sums_initialized = false;
}

/********************************************************************
- AJOUT D’UNE IMAGE GRIS DANS LE BUFFER
********************************************************************/
void motion_push_gray(MotionBuffer &mb, const Mat &gray)
{
    gray.copyTo(mb.grayBuf[mb.idx]);
    mb.idx = (mb.idx + 1) % (2 * mb.n);
    if (mb.count < 2 * mb.n) mb.count++;
}

/********************************************************************
- CONSTRUCTION DU MASQUE DE MOUVEMENT (DIFFÉRENCE IR2 - IR1)
********************************************************************/
bool motion_compute_mask(MotionBuffer &mb, Mat &mask, int threshold_pixel)
{
    int B = 2 * mb.n;
    if (mb.count < B) {
        mask = Mat::zeros(mb.IR1.size(), CV_8U);
        return false; // pas assez d'images accumulées
    }

    int newest = (mb.idx - 1 + B) % B;

    // Première initialisation complète si nécessaire
    if (!mb.sums_initialized) {
        mb.IR1 = Mat::zeros(mb.IR1.size(), CV_32S);//On le remet à zéro
        mb.IR2 = Mat::zeros(mb.IR2.size(), CV_32S);
        // IR1 : les n premières (anciens)
        for (int k = 0; k < mb.n; ++k) {
            int idx1 = (mb.idx - 1 - (2*mb.n - 1) + k + 10*B) % B;
            Mat tmp; mb.grayBuf[idx1].convertTo(tmp, CV_32S);
            mb.IR1 += tmp;
        }
        // IR2 : les n dernières (récentes)
        for (int k = 0; k < mb.n; ++k) {
            int idx2 = (mb.idx - 1 - (mb.n - 1) + k + 10*B) % B;
            Mat tmp; mb.grayBuf[idx2].convertTo(tmp, CV_32S);
            mb.IR2 += tmp;
        }
        mb.sums_initialized = true;
    } else {
        // Incrémental : on fait 3 opérations matricielles
        // 1) soustraire la plus ancienne image qui était dans IR1
        int idx_old_IR1 = (mb.idx - 1 - (2*mb.n - 1) + 10*B) % B;
        Mat tmpOld; mb.grayBuf[idx_old_IR1].convertTo(tmpOld, CV_32S);
        mb.IR1 -= tmpOld;

        // 2) déplacer la première de IR2 vers IR1 (celle qui devient la plus ancienne de IR2)
        int idx_move = (mb.idx - 1 - (mb.n - 1) + 10*B) % B;
        Mat tmpMove; mb.grayBuf[idx_move].convertTo(tmpMove, CV_32S);
        mb.IR1 += tmpMove;
        mb.IR2 -= tmpMove;

        // 3) ajouter la plus récente dans IR2
        int idx_new = newest;
        Mat tmpNew; mb.grayBuf[idx_new].convertTo(tmpNew, CV_32S);
        mb.IR2 += tmpNew;
    }

    // absdiff (CV_32S) puis normaliser par n -> CV_8U pour seuil constant
    Mat diff32;
    absdiff(mb.IR2, mb.IR1, diff32); // CV_32S
    Mat diff_norm;
    diff32.convertTo(diff_norm, CV_8U, 1.0 / mb.n);

    // Threshold et nettoyage morphologique
    cv::threshold(diff_norm, mask, threshold_pixel, 255, cv::THRESH_BINARY);
    cv::morphologyEx(mask, mask, cv::MORPH_OPEN, cv::getStructuringElement(cv::MORPH_ELLIPSE, Size(3,3)));
    cv::morphologyEx(mask, mask, cv::MORPH_CLOSE, cv::getStructuringElement(cv::MORPH_ELLIPSE, Size(5,5)));

	//Nettoyage du bruit
	cv::erode(mask,mask, cv::Mat(),cv::Point(-1,-1),1);
	cv::dilate(mask, mask, cv::Mat(), cv::Point(-1,-1),2);
    return true;
}

/********************************************************************
- CALCUL DU BARYCENTRE (avec mémoire + smoothing EMA)
********************************************************************/
Point compute_centroid_keep_last(const Mat &mask, MotionBuffer &mb)
{
    long sumX = 0, sumY = 0, count = 0;
    for (int y = 0; y < mask.rows; ++y) {
        const uchar* row = mask.ptr<uchar>(y);
        for (int x = 0; x < mask.cols; ++x) {
            if (row[x] > 0) {
                sumX += x; sumY += y; ++count;
            }
        }
    }

    if (count < MOTION_AREA_MIN) return mb.lastCentroid;

    Point newC(int(sumX / count), int(sumY / count));

    // smoothing (EMA) pour réduire le jitter
    const double alpha = 0.45; // ajustable (0.2 = très lisse, 0.6 = plus réactif)
    mb.lastCentroid.x = int(alpha * newC.x + (1.0 - alpha) * mb.lastCentroid.x);
    mb.lastCentroid.y = int(alpha * newC.y + (1.0 - alpha) * mb.lastCentroid.y);

    return mb.lastCentroid;
}

/********************************************************************
- CALCUL MOYENNE RGB (vectorisé) avec mémoire
********************************************************************/
Scalar compute_mean_rgb_keep_last(const Mat &colorFrame, const Mat &mask, MotionBuffer &mb)
{
    if (cv::countNonZero(mask) == 0) return mb.lastMeanRGB;

    // cv::mean returns B,G,R ordering
    Scalar meanBGR = cv::mean(colorFrame, mask);
    // convert to R,G,B
    mb.lastMeanRGB = Scalar(meanBGR[2], meanBGR[1], meanBGR[0]);
    return mb.lastMeanRGB;
}

/********************************************************************
- DESSIN D’UNE CROIX
********************************************************************/
void draw_cross(Mat &img, Point p, Scalar color)
{
    int L = 10;
    line(img, Point(p.x - L, p.y), Point(p.x + L, p.y), color, 2);
    line(img, Point(p.x, p.y - L), Point(p.x, p.y + L), color, 2);
}
