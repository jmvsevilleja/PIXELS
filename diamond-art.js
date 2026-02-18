/**
 * Diamond Art pipeline: LAB color matching, Floyd–Steinberg dithering,
 * noise cleanup, diamond-style grid rendering.
 */

// ——— 1. COLOR SPACE (RGB → XYZ → LAB) ———
function rgbToXyz([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  return [x * 100, y * 100, z * 100];
}

function xyzToLab([x, y, z]) {
  const refX = 95.047,
    refY = 100.0,
    refZ = 108.883;
  x /= refX;
  y /= refY;
  z /= refZ;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x),
    fy = f(y),
    fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function rgbToLab(rgb) {
  return xyzToLab(rgbToXyz(rgb));
}

function labDistance(lab1, lab2) {
  return Math.sqrt(
    (lab1[0] - lab2[0]) ** 2 +
      (lab1[1] - lab2[1]) ** 2 +
      (lab1[2] - lab2[2]) ** 2
  );
}

// ——— 2. PALETTE (DMC 454 colors, LAB precomputed) ———
// DMC diamond painting / embroidery floss colors (see diamant-strass-dmc.com)
const PALETTE = [
  { id: 3713, name: "Salmon Very Light", rgb: [255, 226, 226] },
  { id: 761, name: "Salmon Light", rgb: [255, 201, 201] },
  { id: 760, name: "Salmon", rgb: [245, 173, 173] },
  { id: 3712, name: "Salmon Medium", rgb: [241, 135, 135] },
  { id: 3328, name: "Salmon Dark", rgb: [227, 109, 109] },
  { id: 347, name: "Salmon Very Dark", rgb: [191, 45, 45] },
  { id: 353, name: "Peach", rgb: [254, 215, 204] },
  { id: 352, name: "Coral Light", rgb: [253, 156, 151] },
  { id: 351, name: "Coral", rgb: [233, 106, 103] },
  { id: 350, name: "Coral Medium", rgb: [224, 72, 72] },
  { id: 349, name: "Coral Dark", rgb: [210, 16, 53] },
  { id: 817, name: "Coral Red Very Dark", rgb: [187, 5, 31] },
  { id: 3708, name: "Melon Light", rgb: [255, 203, 213] },
  { id: 3706, name: "Melon Medium", rgb: [255, 173, 188] },
  { id: 3705, name: "Melon Dark", rgb: [255, 121, 146] },
  { id: 3801, name: "Melon Very Dark", rgb: [231, 73, 103] },
  { id: 666, name: "Bright Red", rgb: [227, 29, 66] },
  { id: 321, name: "Red", rgb: [199, 43, 59] },
  { id: 304, name: "Red Medium", rgb: [183, 31, 51] },
  { id: 498, name: "Red Dark", rgb: [167, 19, 43] },
  { id: 816, name: "Garnet", rgb: [151, 11, 35] },
  { id: 815, name: "Garnet Medium", rgb: [135, 7, 31] },
  { id: 814, name: "Garnet Dark", rgb: [123, 0, 27] },
  { id: 894, name: "Carnation Very Light", rgb: [255, 178, 187] },
  { id: 893, name: "Carnation Light", rgb: [252, 144, 162] },
  { id: 892, name: "Carnation Medium", rgb: [255, 121, 140] },
  { id: 891, name: "Carnation Dark", rgb: [255, 87, 115] },
  { id: 818, name: "Baby Pink", rgb: [255, 223, 217] },
  { id: 957, name: "Geranium Pale", rgb: [253, 181, 181] },
  { id: 956, name: "Geranium", rgb: [255, 145, 145] },
  { id: 309, name: "Rose Dark", rgb: [86, 74, 74] },
  { id: 963, name: "Dusty Rose Ult Vy Lt", rgb: [255, 215, 215] },
  { id: 3716, name: "Dusty Rose Med Vy Lt", rgb: [255, 189, 189] },
  { id: 962, name: "Dusty Rose Medium", rgb: [230, 138, 138] },
  { id: 961, name: "Dusty Rose Dark", rgb: [207, 115, 115] },
  { id: 3833, name: "Raspberry Light", rgb: [234, 134, 153] },
  { id: 3832, name: "Raspberry Medium", rgb: [219, 85, 110] },
  { id: 3831, name: "Raspberry Dark", rgb: [179, 47, 72] },
  { id: 777, name: "Raspberry Very Dark", rgb: [145, 53, 70] },
  { id: 819, name: "Baby Pink Light", rgb: [255, 238, 235] },
  { id: 3326, name: "Rose Light", rgb: [251, 173, 180] },
  { id: 776, name: "Pink Medium", rgb: [252, 176, 185] },
  { id: 899, name: "Rose Medium", rgb: [242, 118, 136] },
  { id: 335, name: "Rose", rgb: [238, 84, 110] },
  { id: 326, name: "Rose Very Dark", rgb: [179, 59, 75] },
  { id: 151, name: "Dusty Rose Vry Lt", rgb: [240, 206, 212] },
  { id: 3354, name: "Dusty Rose Light", rgb: [228, 166, 172] },
  { id: 3733, name: "Dusty Rose", rgb: [232, 135, 155] },
  { id: 3731, name: "Dusty Rose Very Dark", rgb: [218, 103, 131] },
  { id: 3350, name: "Dusty Rose Ultra Dark", rgb: [188, 67, 101] },
  { id: 150, name: "Dusty Rose Ult Vy Dk", rgb: [171, 2, 73] },
  { id: 3689, name: "Mauve Light", rgb: [251, 191, 194] },
  { id: 3688, name: "Mauve Medium", rgb: [231, 169, 172] },
  { id: 3687, name: "Mauve", rgb: [201, 107, 112] },
  { id: 3803, name: "Mauve Dark", rgb: [171, 51, 87] },
  { id: 3685, name: "Mauve Very Dark", rgb: [136, 21, 49] },
  { id: 605, name: "Cranberry Very Light", rgb: [255, 192, 205] },
  { id: 604, name: "Cranberry Light", rgb: [255, 176, 190] },
  { id: 603, name: "Cranberry", rgb: [255, 164, 190] },
  { id: 602, name: "Cranberry Medium", rgb: [226, 72, 116] },
  { id: 601, name: "Cranberry Dark", rgb: [209, 40, 106] },
  { id: 600, name: "Cranberry Very Dark", rgb: [205, 47, 99] },
  { id: 3806, name: "Cyclamen Pink Light", rgb: [255, 140, 174] },
  { id: 3805, name: "Cyclamen Pink", rgb: [243, 71, 139] },
  { id: 3804, name: "Cyclamen Pink Dark", rgb: [224, 40, 118] },
  { id: 3609, name: "Plum Ultra Light", rgb: [244, 174, 213] },
  { id: 3608, name: "Plum Very Light", rgb: [234, 156, 196] },
  { id: 3607, name: "Plum Light", rgb: [197, 73, 137] },
  { id: 718, name: "Plum", rgb: [156, 36, 98] },
  { id: 917, name: "Plum Medium", rgb: [155, 19, 89] },
  { id: 915, name: "Plum Dark", rgb: [130, 0, 67] },
  { id: 225, name: "Shell Pink Ult Vy Lt", rgb: [255, 223, 213] },
  { id: 224, name: "Shell Pink Very Light", rgb: [235, 183, 175] },
  { id: 152, name: "Shell Pink Med Light", rgb: [226, 160, 153] },
  { id: 223, name: "Shell Pink Light", rgb: [204, 132, 124] },
  { id: 3722, name: "Shell Pink Med", rgb: [188, 108, 100] },
  { id: 3721, name: "Shell Pink Dark", rgb: [161, 75, 81] },
  { id: 221, name: "Shell Pink Vy Dk", rgb: [136, 62, 67] },
  { id: 778, name: "Antique Mauve Vy Lt", rgb: [223, 179, 187] },
  { id: 3727, name: "Antique Mauve Light", rgb: [219, 169, 178] },
  { id: 316, name: "Antique Mauve Med", rgb: [183, 115, 127] },
  { id: 3726, name: "Antique Mauve Dark", rgb: [155, 91, 102] },
  { id: 315, name: "Antique Mauve Md Dk", rgb: [129, 73, 82] },
  { id: 3802, name: "Antique Mauve Vy Dk", rgb: [113, 65, 73] },
  { id: 902, name: "Garnet Very Dark", rgb: [130, 38, 55] },
  { id: 3743, name: "Antique Violet Vy Lt", rgb: [215, 203, 211] },
  { id: 3042, name: "Antique Violet Light", rgb: [183, 157, 167] },
  { id: 3041, name: "Antique Violet Medium", rgb: [149, 111, 124] },
  { id: 3740, name: "Antique Violet Dark", rgb: [120, 87, 98] },
  { id: 3836, name: "Grape Light", rgb: [186, 145, 170] },
  { id: 3835, name: "Grape Medium", rgb: [148, 96, 131] },
  { id: 3834, name: "Grape Dark", rgb: [114, 55, 93] },
  { id: 154, name: "Grape Very Dark", rgb: [87, 36, 51] },
  { id: 211, name: "Lavender Light", rgb: [227, 203, 227] },
  { id: 210, name: "Lavender Medium", rgb: [195, 159, 195] },
  { id: 209, name: "Lavender Dark", rgb: [163, 123, 167] },
  { id: 208, name: "Lavender Very Dark", rgb: [131, 91, 139] },
  { id: 3837, name: "Lavender Ultra Dark", rgb: [108, 58, 110] },
  { id: 327, name: "Violet Dark", rgb: [99, 54, 102] },
  { id: 153, name: "Violet Very Light", rgb: [230, 204, 217] },
  { id: 554, name: "Violet Light", rgb: [219, 179, 203] },
  { id: 553, name: "Violet", rgb: [163, 99, 139] },
  { id: 552, name: "Violet  Medium", rgb: [128, 58, 107] },
  { id: 550, name: "Violet Very Dark", rgb: [92, 24, 78] },
  { id: 3747, name: "Blue Violet Vy Lt", rgb: [211, 215, 237] },
  { id: 341, name: "Blue Violet Light", rgb: [183, 191, 221] },
  { id: 156, name: "Blue Violet Med Lt", rgb: [163, 174, 209] },
  { id: 340, name: "Blue Violet Medium", rgb: [173, 167, 199] },
  { id: 155, name: "Blue Violet Med Dark", rgb: [152, 145, 182] },
  { id: 3746, name: "Blue Violet Dark", rgb: [119, 107, 152] },
  { id: 333, name: "Blue Violet Very Dark", rgb: [92, 84, 120] },
  { id: 157, name: "Cornflower Blue Vy Lt", rgb: [187, 195, 217] },
  { id: 794, name: "Cornflower Blue Light", rgb: [143, 156, 193] },
  { id: 793, name: "Cornflower Blue Med", rgb: [112, 125, 162] },
  { id: 3807, name: "Cornflower Blue", rgb: [96, 103, 140] },
  { id: 792, name: "Cornflower Blue Dark", rgb: [85, 91, 123] },
  { id: 158, name: "Cornflower Blu M V D", rgb: [76, 82, 110] },
  { id: 791, name: "Cornflower Blue V D", rgb: [70, 69, 99] },
  { id: 3840, name: "Lavender Blue Light", rgb: [176, 192, 218] },
  { id: 3839, name: "Lavender Blue Med", rgb: [123, 142, 171] },
  { id: 3838, name: "Lavender Blue Dark", rgb: [92, 114, 148] },
  { id: 800, name: "Delft Blue Pale", rgb: [192, 204, 222] },
  { id: 809, name: "Delft Blue", rgb: [148, 168, 198] },
  { id: 799, name: "Delft Blue Medium", rgb: [116, 142, 182] },
  { id: 798, name: "Delft Blue Dark", rgb: [70, 106, 142] },
  { id: 797, name: "Royal Blue", rgb: [19, 71, 125] },
  { id: 796, name: "Royal Blue Dark", rgb: [17, 65, 109] },
  { id: 820, name: "Royal Blue Very Dark", rgb: [14, 54, 92] },
  { id: 162, name: "Blue Ultra Very Light", rgb: [219, 236, 245] },
  { id: 827, name: "Blue Very Light", rgb: [189, 221, 237] },
  { id: 813, name: "Blue Light", rgb: [161, 194, 215] },
  { id: 826, name: "Blue Medium", rgb: [107, 158, 191] },
  { id: 825, name: "Blue Dark", rgb: [71, 129, 165] },
  { id: 824, name: "Blue Very Dark", rgb: [57, 105, 135] },
  { id: 996, name: "Electric Blue Medium", rgb: [48, 194, 236] },
  { id: 3843, name: "Electric Blue", rgb: [20, 170, 208] },
  { id: 995, name: "Electric Blue Dark", rgb: [38, 150, 182] },
  { id: 3846, name: "Turquoise Bright Light", rgb: [6, 227, 230] },
  { id: 3845, name: "Turquoise Bright Med", rgb: [4, 196, 202] },
  { id: 3844, name: "Turquoise Bright Dark", rgb: [18, 174, 186] },
  { id: 159, name: "Blue Gray Light", rgb: [199, 202, 215] },
  { id: 160, name: "Blue Gray Medium", rgb: [153, 159, 183] },
  { id: 161, name: "Blue Gray", rgb: [120, 128, 164] },
  { id: 3756, name: "Baby Blue Ult Vy Lt", rgb: [238, 252, 252] },
  { id: 775, name: "Baby Blue Very Light", rgb: [217, 235, 241] },
  { id: 3841, name: "Baby Blue Pale", rgb: [205, 223, 237] },
  { id: 3325, name: "Baby Blue Light", rgb: [184, 210, 230] },
  { id: 3755, name: "Baby Blue", rgb: [147, 180, 206] },
  { id: 334, name: "Baby Blue Medium", rgb: [115, 159, 193] },
  { id: 322, name: "Baby Blue Dark", rgb: [90, 143, 184] },
  { id: 312, name: "Baby Blue Very Dark", rgb: [53, 102, 139] },
  { id: 803, name: "Baby Blue Ult Vy Dk", rgb: [44, 89, 124] },
  { id: 336, name: "Navy Blue", rgb: [37, 59, 115] },
  { id: 823, name: "Navy Blue Dark", rgb: [33, 48, 99] },
  { id: 939, name: "Navy Blue Very Dark", rgb: [27, 40, 83] },
  { id: 3753, name: "Antique Blue Ult Vy Lt", rgb: [219, 226, 233] },
  { id: 3752, name: "Antique Blue Very Lt", rgb: [199, 209, 219] },
  { id: 932, name: "Antique Blue Light", rgb: [162, 181, 198] },
  { id: 931, name: "Antique Blue Medium", rgb: [106, 133, 158] },
  { id: 930, name: "Antique Blue Dark", rgb: [69, 92, 113] },
  { id: 3750, name: "Antique Blue Very Dk", rgb: [56, 76, 94] },
  { id: 828, name: "Sky Blue Vy Lt", rgb: [197, 232, 237] },
  { id: 3761, name: "Sky Blue Light", rgb: [172, 216, 226] },
  { id: 519, name: "Sky Blue", rgb: [126, 177, 200] },
  { id: 518, name: "Wedgewood Light", rgb: [79, 147, 167] },
  { id: 3760, name: "Wedgewood Med", rgb: [62, 133, 162] },
  { id: 517, name: "Wedgewood Dark", rgb: [59, 118, 143] },
  { id: 3842, name: "Wedgewood Vry Dk", rgb: [50, 102, 124] },
  { id: 311, name: "Wedgewood Ult VyDk", rgb: [28, 80, 102] },
  { id: 747, name: "Peacock Blue Vy Lt", rgb: [229, 252, 253] },
  { id: 3766, name: "Peacock Blue Light", rgb: [153, 207, 217] },
  { id: 807, name: "Peacock Blue", rgb: [100, 171, 186] },
  { id: 806, name: "Peacock Blue Dark", rgb: [61, 149, 165] },
  { id: 3765, name: "Peacock Blue Vy Dk", rgb: [52, 127, 140] },
  { id: 3811, name: "Turquoise Very Light", rgb: [188, 227, 230] },
  { id: 598, name: "Turquoise Light", rgb: [144, 195, 204] },
  { id: 597, name: "Turquoise", rgb: [91, 163, 179] },
  { id: 3810, name: "Turquoise Dark", rgb: [72, 142, 154] },
  { id: 3809, name: "Turquoise Vy Dark", rgb: [63, 124, 133] },
  { id: 3808, name: "Turquoise Ult Vy Dk", rgb: [54, 105, 112] },
  { id: 928, name: "Gray Green Vy Lt", rgb: [221, 227, 227] },
  { id: 927, name: "Gray Green Light", rgb: [189, 203, 203] },
  { id: 926, name: "Gray Green Med", rgb: [152, 174, 174] },
  { id: 3768, name: "Gray Green Dark", rgb: [101, 127, 127] },
  { id: 924, name: "Gray Green Vy Dark", rgb: [86, 106, 106] },
  { id: 3849, name: "Teal Green Light", rgb: [82, 179, 164] },
  { id: 3848, name: "Teal Green Med", rgb: [85, 147, 146] },
  { id: 3847, name: "Teal Green Dark", rgb: [52, 125, 117] },
  { id: 964, name: "Sea Green Light", rgb: [169, 226, 216] },
  { id: 959, name: "Sea Green Med", rgb: [89, 199, 180] },
  { id: 958, name: "Sea Green Dark", rgb: [62, 182, 161] },
  { id: 3812, name: "Sea Green Vy Dk", rgb: [47, 140, 132] },
  { id: 3851, name: "Green Bright Lt", rgb: [73, 179, 161] },
  { id: 943, name: "Green Bright Md", rgb: [61, 147, 132] },
  { id: 3850, name: "Green Bright Dk", rgb: [55, 132, 119] },
  { id: 993, name: "Aquamarine Vy Lt", rgb: [144, 192, 180] },
  { id: 992, name: "Aquamarine Lt", rgb: [111, 174, 159] },
  { id: 3814, name: "Aquamarine", rgb: [80, 139, 125] },
  { id: 991, name: "Aquamarine Dk", rgb: [71, 123, 110] },
  { id: 966, name: "Jade Ultra Vy Lt", rgb: [185, 215, 192] },
  { id: 564, name: "Jade Very Light", rgb: [167, 205, 175] },
  { id: 563, name: "Jade Light", rgb: [143, 192, 152] },
  { id: 562, name: "Jade Medium", rgb: [83, 151, 106] },
  { id: 505, name: "Jade Green", rgb: [51, 131, 98] },
  { id: 3817, name: "Celadon Green Lt", rgb: [153, 195, 170] },
  { id: 3816, name: "Celadon Green", rgb: [101, 165, 125] },
  { id: 163, name: "Celadon Green Md", rgb: [77, 131, 97] },
  { id: 3815, name: "Celadon Green Dk", rgb: [71, 119, 89] },
  { id: 561, name: "Celadon Green VD", rgb: [44, 106, 69] },
  { id: 504, name: "Blue Green Vy Lt", rgb: [196, 222, 204] },
  { id: 3813, name: "Blue Green Lt", rgb: [178, 212, 189] },
  { id: 503, name: "Blue Green Med", rgb: [123, 172, 148] },
  { id: 502, name: "Blue Green", rgb: [91, 144, 113] },
  { id: 501, name: "Blue Green Dark", rgb: [57, 111, 82] },
  { id: 500, name: "Blue Green Vy Dk", rgb: [4, 77, 51] },
  { id: 955, name: "Nile Green Light", rgb: [162, 214, 173] },
  { id: 954, name: "Nile Green", rgb: [136, 186, 145] },
  { id: 913, name: "Nile Green Med", rgb: [109, 171, 119] },
  { id: 912, name: "Emerald Green Lt", rgb: [27, 157, 107] },
  { id: 911, name: "Emerald Green Med", rgb: [24, 144, 101] },
  { id: 910, name: "Emerald Green Dark", rgb: [24, 126, 86] },
  { id: 909, name: "Emerald Green Vy Dk", rgb: [21, 111, 73] },
  { id: 3818, name: "Emerald Grn Ult V Dk", rgb: [17, 90, 59] },
  { id: 369, name: "Pistachio Green Vy Lt", rgb: [215, 237, 204] },
  { id: 368, name: "Pistachio Green Lt", rgb: [166, 194, 152] },
  { id: 320, name: "Pistachio Green Med", rgb: [105, 136, 90] },
  { id: 367, name: "Pistachio Green Dk", rgb: [97, 122, 82] },
  { id: 319, name: "Pistachio Grn Vy Dk", rgb: [32, 95, 46] },
  { id: 890, name: "Pistachio Grn Ult V D", rgb: [23, 73, 35] },
  { id: 164, name: "Forest Green Lt", rgb: [200, 216, 184] },
  { id: 989, name: "Forest Green", rgb: [141, 166, 117] },
  { id: 988, name: "Forest Green Med", rgb: [115, 139, 91] },
  { id: 987, name: "Forest Green Dk", rgb: [88, 113, 65] },
  { id: 986, name: "Forest Green Vy Dk", rgb: [64, 82, 48] },
  { id: 772, name: "Yellow Green Vy Lt", rgb: [228, 236, 212] },
  { id: 3348, name: "Yellow Green Lt", rgb: [204, 217, 177] },
  { id: 3347, name: "Yellow Green Med", rgb: [113, 147, 92] },
  { id: 3346, name: "Hunter Green", rgb: [64, 106, 58] },
  { id: 3345, name: "Hunter Green Dk", rgb: [27, 89, 21] },
  { id: 895, name: "Hunter Green Vy Dk", rgb: [27, 83, 0] },
  { id: 704, name: "Chartreuse Bright", rgb: [158, 207, 52] },
  { id: 703, name: "Chartreuse", rgb: [123, 181, 71] },
  { id: 702, name: "Kelly Green", rgb: [71, 167, 47] },
  { id: 701, name: "Green Light", rgb: [63, 143, 41] },
  { id: 700, name: "Green Bright", rgb: [7, 115, 27] },
  { id: 699, name: "Green", rgb: [5, 101, 23] },
  { id: 907, name: "Parrot Green Lt", rgb: [199, 230, 102] },
  { id: 906, name: "Parrot Green Md", rgb: [127, 179, 53] },
  { id: 905, name: "Parrot Green Dk", rgb: [98, 138, 40] },
  { id: 904, name: "Parrot Green V Dk", rgb: [85, 120, 34] },
  { id: 472, name: "Avocado Grn U Lt", rgb: [216, 228, 152] },
  { id: 471, name: "Avocado Grn V Lt", rgb: [174, 191, 121] },
  { id: 470, name: "Avocado Grn Lt", rgb: [148, 171, 79] },
  { id: 469, name: "Avocado Green", rgb: [114, 132, 60] },
  { id: 937, name: "Avocado Green Md", rgb: [98, 113, 51] },
  { id: 936, name: "Avocado Grn V Dk", rgb: [76, 88, 38] },
  { id: 935, name: "Avocado Green Dk", rgb: [66, 77, 33] },
  { id: 934, name: "Avocado Grn Black", rgb: [49, 57, 25] },
  { id: 523, name: "Fern Green Lt", rgb: [171, 177, 151] },
  { id: 3053, name: "Green Gray", rgb: [156, 164, 130] },
  { id: 3052, name: "Green Gray Md", rgb: [136, 146, 104] },
  { id: 3051, name: "Green Gray Dk", rgb: [95, 102, 72] },
  { id: 524, name: "Fern Green Vy Lt", rgb: [196, 205, 172] },
  { id: 522, name: "Fern Green", rgb: [150, 158, 126] },
  { id: 520, name: "Fern Green Dark", rgb: [102, 109, 79] },
  { id: 3364, name: "Pine Green", rgb: [131, 151, 95] },
  { id: 3363, name: "Pine Green Md", rgb: [114, 130, 86] },
  { id: 3362, name: "Pine Green Dk", rgb: [94, 107, 71] },
  { id: 165, name: "Moss Green Vy Lt", rgb: [239, 244, 164] },
  { id: 3819, name: "Moss Green Lt", rgb: [224, 232, 104] },
  { id: 166, name: "Moss Green Md Lt", rgb: [192, 200, 64] },
  { id: 581, name: "Moss Green", rgb: [167, 174, 56] },
  { id: 580, name: "Moss Green Dk", rgb: [136, 141, 51] },
  { id: 734, name: "Olive Green Lt", rgb: [199, 192, 119] },
  { id: 733, name: "Olive Green Md", rgb: [188, 179, 76] },
  { id: 732, name: "Olive Green", rgb: [148, 140, 54] },
  { id: 731, name: "Olive Green Dk", rgb: [147, 139, 55] },
  { id: 730, name: "Olive Green V Dk", rgb: [130, 123, 48] },
  { id: 3013, name: "Khaki Green Lt", rgb: [185, 185, 130] },
  { id: 3012, name: "Khaki Green Md", rgb: [166, 167, 93] },
  { id: 3011, name: "Khaki Green Dk", rgb: [137, 138, 88] },
  { id: 372, name: "Mustard Lt", rgb: [204, 183, 132] },
  { id: 371, name: "Mustard", rgb: [191, 166, 113] },
  { id: 370, name: "Mustard Medium", rgb: [184, 157, 100] },
  { id: 834, name: "Golden Olive Vy Lt", rgb: [219, 190, 127] },
  { id: 833, name: "Golden Olive Lt", rgb: [200, 171, 108] },
  { id: 832, name: "Golden Olive", rgb: [189, 155, 81] },
  { id: 831, name: "Golden Olive Md", rgb: [170, 143, 86] },
  { id: 830, name: "Golden Olive Dk", rgb: [141, 120, 75] },
  { id: 829, name: "Golden Olive Vy Dk", rgb: [126, 107, 66] },
  { id: 613, name: "Drab Brown V Lt", rgb: [220, 196, 170] },
  { id: 612, name: "Drab Brown Lt", rgb: [188, 154, 120] },
  { id: 611, name: "Drab Brown", rgb: [150, 118, 86] },
  { id: 610, name: "Drab Brown Dk", rgb: [121, 96, 71] },
  { id: 3047, name: "Yellow Beige Lt", rgb: [231, 214, 193] },
  { id: 3046, name: "Yellow Beige Md", rgb: [216, 188, 154] },
  { id: 3045, name: "Yellow Beige Dk", rgb: [188, 150, 106] },
  { id: 167, name: "Yellow Beige V Dk", rgb: [167, 124, 73] },
  { id: 746, name: "Off White", rgb: [252, 252, 238] },
  { id: 677, name: "Old Gold Vy Lt", rgb: [245, 236, 203] },
  { id: 422, name: "Hazelnut Brown Lt", rgb: [198, 159, 123] },
  { id: 3828, name: "Hazelnut Brown", rgb: [183, 139, 97] },
  { id: 420, name: "Hazelnut Brown Dk", rgb: [160, 112, 66] },
  { id: 869, name: "Hazelnut Brown V Dk", rgb: [131, 94, 57] },
  { id: 728, name: "Topaz", rgb: [228, 180, 104] },
  { id: 783, name: "Topaz Medium", rgb: [206, 145, 36] },
  { id: 782, name: "Topaz Dark", rgb: [174, 119, 32] },
  { id: 781, name: "Topaz Very Dark", rgb: [162, 109, 32] },
  { id: 780, name: "Topaz Ultra Vy Dk", rgb: [148, 99, 26] },
  { id: 676, name: "Old Gold Lt", rgb: [229, 206, 151] },
  { id: 729, name: "Old Gold Medium", rgb: [208, 165, 62] },
  { id: 680, name: "Old Gold Dark", rgb: [188, 141, 14] },
  { id: 3829, name: "Old Gold Vy Dark", rgb: [169, 130, 4] },
  { id: 3822, name: "Straw Light", rgb: [246, 220, 152] },
  { id: 3821, name: "Straw", rgb: [243, 206, 117] },
  { id: 3820, name: "Straw Dark", rgb: [223, 182, 95] },
  { id: 3852, name: "Straw Very Dark", rgb: [205, 157, 55] },
  { id: 445, name: "Lemon Light", rgb: [255, 251, 139] },
  { id: 307, name: "Lemon", rgb: [253, 237, 84] },
  { id: 973, name: "Canary Bright", rgb: [255, 227, 0] },
  { id: 444, name: "Lemon Dark", rgb: [255, 214, 0] },
  { id: 3078, name: "Golden Yellow Vy Lt", rgb: [253, 249, 205] },
  { id: 727, name: "Topaz Vy Lt", rgb: [255, 241, 175] },
  { id: 726, name: "Topaz Light", rgb: [253, 215, 85] },
  { id: 725, name: "Topaz Med Lt", rgb: [255, 200, 64] },
  { id: 972, name: "Canary Deep", rgb: [255, 181, 21] },
  { id: 745, name: "Yellow Pale Light", rgb: [255, 233, 173] },
  { id: 744, name: "Yellow Pale", rgb: [255, 231, 147] },
  { id: 743, name: "Yellow Med", rgb: [254, 211, 118] },
  { id: 742, name: "Tangerine Light", rgb: [255, 191, 87] },
  { id: 741, name: "Tangerine Med", rgb: [255, 163, 43] },
  { id: 740, name: "Tangerine", rgb: [255, 139, 0] },
  { id: 970, name: "Pumpkin Light", rgb: [247, 139, 19] },
  { id: 971, name: "Pumpkin", rgb: [246, 127, 0] },
  { id: 947, name: "Burnt Orange", rgb: [255, 123, 77] },
  { id: 946, name: "Burnt Orange Med", rgb: [235, 99, 7] },
  { id: 900, name: "Burnt Orange Dark", rgb: [209, 88, 7] },
  { id: 967, name: "Apricot Very Light", rgb: [255, 222, 213] },
  { id: 3824, name: "Apricot Light", rgb: [254, 205, 194] },
  { id: 3341, name: "Apricot", rgb: [252, 171, 152] },
  { id: 3340, name: "Apricot Med", rgb: [255, 131, 111] },
  { id: 608, name: "Burnt Orange Bright", rgb: [253, 93, 53] },
  { id: 606, name: "Orange?Red Bright", rgb: [250, 50, 3] },
  { id: 951, name: "Tawny Light", rgb: [255, 226, 207] },
  { id: 3856, name: "Mahogany Ult Vy Lt", rgb: [255, 211, 181] },
  { id: 722, name: "Orange Spice Light", rgb: [247, 151, 111] },
  { id: 721, name: "Orange Spice Med", rgb: [242, 120, 66] },
  { id: 720, name: "Orange Spice Dark", rgb: [229, 92, 31] },
  { id: 3825, name: "Pumpkin Pale", rgb: [253, 189, 150] },
  { id: 922, name: "Copper Light", rgb: [226, 115, 35] },
  { id: 921, name: "Copper", rgb: [198, 98, 24] },
  { id: 920, name: "Copper Med", rgb: [172, 84, 20] },
  { id: 919, name: "Red?Copper", rgb: [166, 69, 16] },
  { id: 918, name: "Red?Copper Dark", rgb: [130, 52, 10] },
  { id: 3770, name: "Tawny Vy Light", rgb: [255, 238, 227] },
  { id: 945, name: "Tawny", rgb: [251, 213, 187] },
  { id: 402, name: "Mahogany Vy Lt", rgb: [247, 167, 119] },
  { id: 3776, name: "Mahogany Light", rgb: [207, 121, 57] },
  { id: 301, name: "Mahogany Med", rgb: [179, 95, 43] },
  { id: 400, name: "Mahogany Dark", rgb: [143, 67, 15] },
  { id: 300, name: "Mahogany Vy Dk", rgb: [111, 47, 0] },
  { id: 3823, name: "Yellow Ultra Pale", rgb: [255, 253, 227] },
  { id: 3855, name: "Autumn Gold Lt", rgb: [250, 211, 150] },
  { id: 3854, name: "Autumn Gold Med", rgb: [242, 175, 104] },
  { id: 3853, name: "Autumn Gold Dk", rgb: [242, 151, 70] },
  { id: 3827, name: "Golden Brown Pale", rgb: [247, 187, 119] },
  { id: 977, name: "Golden Brown Light", rgb: [220, 156, 86] },
  { id: 976, name: "Golden Brown Med", rgb: [194, 129, 66] },
  { id: 3826, name: "Golden Brown", rgb: [173, 114, 57] },
  { id: 975, name: "Golden Brown Dk", rgb: [145, 79, 18] },
  { id: 948, name: "Peach Very Light", rgb: [254, 231, 218] },
  { id: 754, name: "Peach Light", rgb: [247, 203, 191] },
  { id: 3771, name: "Terra Cotta Ult Vy Lt", rgb: [244, 187, 169] },
  { id: 758, name: "Terra Cotta Vy Lt", rgb: [238, 170, 155] },
  { id: 3778, name: "Terra Cotta Light", rgb: [217, 137, 120] },
  { id: 356, name: "Terra Cotta Med", rgb: [197, 106, 91] },
  { id: 3830, name: "Terra Cotta", rgb: [185, 85, 68] },
  { id: 355, name: "Terra Cotta Dark", rgb: [152, 68, 54] },
  { id: 3777, name: "Terra Cotta Vy Dk", rgb: [134, 48, 34] },
  { id: 3779, name: "Rosewood Ult Vy Lt", rgb: [248, 202, 200] },
  { id: 3859, name: "Rosewood Light", rgb: [186, 139, 124] },
  { id: 3858, name: "Rosewood Med", rgb: [150, 74, 63] },
  { id: 3857, name: "Rosewood Dark", rgb: [104, 37, 26] },
  { id: 3774, name: "Desert Sand Vy Lt", rgb: [243, 225, 215] },
  { id: 950, name: "Desert Sand Light", rgb: [238, 211, 196] },
  { id: 3064, name: "Desert Sand", rgb: [196, 142, 112] },
  { id: 407, name: "Desert Sand Med", rgb: [187, 129, 97] },
  { id: 3773, name: "Desert Sand Dark", rgb: [182, 117, 82] },
  { id: 3772, name: "Desert Sand Vy Dk", rgb: [160, 108, 80] },
  { id: 632, name: "Desert Sand Ult Vy Dk", rgb: [135, 85, 57] },
  { id: 453, name: "Shell Gray Light", rgb: [215, 206, 203] },
  { id: 452, name: "Shell Gray Med", rgb: [192, 179, 174] },
  { id: 451, name: "Shell Gray Dark", rgb: [145, 123, 115] },
  { id: 3861, name: "Cocoa Light", rgb: [166, 136, 129] },
  { id: 3860, name: "Cocoa", rgb: [125, 93, 87] },
  { id: 779, name: "Cocoa Dark", rgb: [98, 75, 69] },
  { id: 712, name: "Cream", rgb: [255, 251, 239] },
  { id: 739, name: "Tan Ult Vy Lt", rgb: [248, 228, 200] },
  { id: 738, name: "Tan Very Light", rgb: [236, 204, 158] },
  { id: 437, name: "Tan Light", rgb: [228, 187, 142] },
  { id: 436, name: "Tan", rgb: [203, 144, 81] },
  { id: 435, name: "Brown Very Light", rgb: [184, 119, 72] },
  { id: 434, name: "Brown Light", rgb: [152, 94, 51] },
  { id: 433, name: "Brown Med", rgb: [122, 69, 31] },
  { id: 801, name: "Coffee Brown Dk", rgb: [101, 57, 25] },
  { id: 898, name: "Coffee Brown Vy Dk", rgb: [73, 42, 19] },
  { id: 938, name: "Coffee Brown Ult Dk", rgb: [54, 31, 14] },
  { id: 3371, name: "Black Brown", rgb: [30, 17, 8] },
  { id: 543, name: "Beige Brown Ult Vy Lt", rgb: [242, 227, 206] },
  { id: 3864, name: "Mocha Beige Light", rgb: [203, 182, 156] },
  { id: 3863, name: "Mocha Beige Med", rgb: [164, 131, 92] },
  { id: 3862, name: "Mocha Beige Dark", rgb: [138, 110, 78] },
  { id: 3031, name: "Mocha Brown Vy Dk", rgb: [75, 60, 42] },
  { id: 414, name: "Snow White", rgb: [255, 255, 255] },
  { id: 415, name: "White", rgb: [252, 251, 248] },
  { id: 3865, name: "Winter White", rgb: [249, 247, 241] },
  { id: 417, name: "Ecru", rgb: [240, 234, 218] },
  { id: 822, name: "Beige Gray Light", rgb: [231, 226, 211] },
  { id: 644, name: "Beige Gray Med", rgb: [221, 216, 203] },
  { id: 642, name: "Beige Gray Dark", rgb: [164, 152, 120] },
  { id: 640, name: "Beige Gray Vy Dk", rgb: [133, 123, 97] },
  { id: 3787, name: "Brown Gray Dark", rgb: [98, 93, 80] },
  { id: 3021, name: "Brown Gray Vy Dk", rgb: [79, 75, 65] },
  { id: 3024, name: "Brown Gray Vy Lt", rgb: [235, 234, 231] },
  { id: 3023, name: "Brown Gray Light", rgb: [177, 170, 151] },
  { id: 3022, name: "Brown Gray Med", rgb: [142, 144, 120] },
  { id: 535, name: "Ash Gray Vy Lt", rgb: [99, 100, 88] },
  { id: 3033, name: "Mocha Brown Vy Lt", rgb: [227, 216, 204] },
  { id: 3782, name: "Mocha Brown Lt", rgb: [210, 188, 166] },
  { id: 3032, name: "Mocha Brown Med", rgb: [179, 159, 139] },
  { id: 3790, name: "Beige Gray Ult Dk", rgb: [127, 106, 85] },
  { id: 3781, name: "Mocha Brown Dk", rgb: [107, 87, 67] },
  { id: 3866, name: "Mocha Brn Ult Vy Lt", rgb: [250, 246, 240] },
  { id: 842, name: "Beige Brown Vy Lt", rgb: [209, 186, 161] },
  { id: 841, name: "Beige Brown Lt", rgb: [182, 155, 126] },
  { id: 840, name: "Beige Brown Med", rgb: [154, 124, 92] },
  { id: 839, name: "Beige Brown Dk", rgb: [103, 85, 65] },
  { id: 838, name: "Beige Brown Vy Dk", rgb: [89, 73, 55] },
  { id: 3072, name: "Beaver Gray Vy Lt", rgb: [230, 232, 232] },
  { id: 648, name: "Beaver Gray Lt", rgb: [188, 180, 172] },
  { id: 647, name: "Beaver Gray Med", rgb: [176, 166, 156] },
  { id: 646, name: "Beaver Gray Dk", rgb: [135, 125, 115] },
  { id: 645, name: "Beaver Gray Vy Dk", rgb: [110, 101, 92] },
  { id: 844, name: "Beaver Gray Ult Dk", rgb: [72, 72, 72] },
  { id: 762, name: "Pearl Gray Vy Lt", rgb: [236, 236, 236] },
  { id: 415, name: "Pearl Gray", rgb: [211, 211, 214] },
  { id: 318, name: "Steel Gray Lt", rgb: [171, 171, 171] },
  { id: 414, name: "Steel Gray Dk", rgb: [140, 140, 140] },
  { id: 168, name: "Pewter Very Light", rgb: [209, 209, 209] },
  { id: 169, name: "Pewter Light", rgb: [132, 132, 132] },
  { id: 317, name: "Pewter Gray", rgb: [108, 108, 108] },
  { id: 413, name: "Pewter Gray Dark", rgb: [86, 86, 86] },
  { id: 3799, name: "Pewter Gray Vy Dk", rgb: [66, 66, 66] },
  { id: 310, name: "Black", rgb: [0, 0, 0] },
];
PALETTE.forEach((c) => {
  c.lab = rgbToLab(c.rgb);
});

// Style palettes (grayscale, vintage, pop-art)
const GRAYSCALE_PALETTE = [
  { id: "g1", name: "Black", rgb: [0, 0, 0] },
  { id: "g2", name: "Dark Gray", rgb: [64, 64, 64] },
  { id: "g3", name: "Gray", rgb: [128, 128, 128] },
  { id: "g4", name: "Light Gray", rgb: [192, 192, 192] },
  { id: "g5", name: "Snow White", rgb: [255, 250, 250] },
];

const VINTAGE_PALETTE = [
  { id: "v1", name: "Near Black", rgb: [62, 39, 35] },
  { id: "v2", name: "Umber", rgb: [99, 81, 71] },
  { id: "v3", name: "Dark Brown", rgb: [101, 67, 33] },
  { id: "v4", name: "Burnt Sienna", rgb: [138, 54, 15] },
  { id: "v5", name: "Sepia", rgb: [112, 66, 20] },
  { id: "v6", name: "Sepia Light", rgb: [166, 124, 82] },
  { id: "v7", name: "Tan", rgb: [210, 180, 140] },
  { id: "v8", name: "Antique White", rgb: [250, 235, 215] },
  { id: "v9", name: "Parchment", rgb: [241, 228, 195] },
  { id: "v10", name: "Cream", rgb: [255, 253, 208] },
];

const POP_ART_PALETTE = [
  { id: "p1", name: "Black / Very dark gray", rgb: [28, 28, 28] },
  { id: "p2", name: "Purple / Violet", rgb: [148, 0, 211] },
  { id: "p3", name: "Pink / Magenta", rgb: [255, 0, 255] },
  { id: "p4", name: "Teal / Cyan", rgb: [0, 180, 180] },
  { id: "p5", name: "Light Teal / Aqua", rgb: [100, 218, 218] },
  { id: "p6", name: "Orange (amber)", rgb: [255, 191, 0] },
  { id: "p7", name: "Yellow (golden)", rgb: [255, 215, 0] },
  { id: "p8", name: "Very light gray", rgb: [240, 240, 240] },
  { id: "p9", name: "White / Very light gray", rgb: [252, 252, 252] },
];

function withLab(entries) {
  return entries.map((c) => ({ ...c, lab: rgbToLab(c.rgb) }));
}

function getStylePalette(style) {
  if (style === "grayscale") return withLab(GRAYSCALE_PALETTE);
  if (style === "vintage") return withLab(VINTAGE_PALETTE);
  if (style === "pop-art") return withLab(POP_ART_PALETTE);
  return null;
}

function findNearestColorLAB(rgb, palette) {
  const pal = palette || PALETTE;
  const lab = rgbToLab(rgb);
  let minDist = Infinity;
  let nearest = pal[0];
  for (const color of pal) {
    const dist = labDistance(lab, color.lab);
    if (dist < minDist) {
      minDist = dist;
      nearest = color;
    }
  }
  return nearest;
}

// Get a reduced palette with N colors evenly spread by luminance
function getReducedPalette(maxColors) {
  if (maxColors >= PALETTE.length) return PALETTE;
  if (maxColors <= 1) return [PALETTE[0]];

  // Sort palette by luminance (L in LAB)
  const sorted = [...PALETTE].sort((a, b) => a.lab[0] - b.lab[0]);

  if (maxColors === 2) {
    return [sorted[0], sorted[sorted.length - 1]];
  }

  // Pick evenly spaced entries across the luminance range
  const result = [];
  for (let i = 0; i < maxColors; i++) {
    const index = Math.round((i / (maxColors - 1)) * (sorted.length - 1));
    if (!result.includes(sorted[index])) {
      result.push(sorted[index]);
    }
  }
  return result;
}

// ——— 3. PREPROCESS (contrast = black/white levels, saturation = color intensity) ———
function enhanceImage(ctx, w, h, opts) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  // Contrast: black/white levels (1 = unchanged, >1 = more punch)
  const contrast =
    opts && opts.contrastIntensity != null ? opts.contrastIntensity : 1;
  // Saturation: color intensity (1 = unchanged, 0 = grayscale, >1 = more vivid)
  const saturation = opts && opts.saturation != null ? opts.saturation : 1;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    // 1) Contrast: stretch/compress around mid gray (128)
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    // 2) Saturation: blend toward gray (avg) or away from it
    const avg = (r + g + b) / 3;
    r = avg + (r - avg) * saturation;
    g = avg + (g - avg) * saturation;
    b = avg + (b - avg) * saturation;
    d[i] = Math.max(0, Math.min(255, r));
    d[i + 1] = Math.max(0, Math.min(255, g));
    d[i + 2] = Math.max(0, Math.min(255, b));
  }
  ctx.putImageData(imgData, 0, 0);
}

// ——— 4. DITHERING + PALETTE MAPPING ———
function applyDiamondQuantization(ctx, w, h, palette) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const set = (x, y, r, g, b) => {
    const i = (y * w + x) * 4;
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const oldRgb = [d[i], d[i + 1], d[i + 2]];
      const nearest = findNearestColorLAB(oldRgb, palette);
      const [nr, ng, nb] = nearest.rgb;
      set(x, y, nr, ng, nb);
      const er = (oldRgb[0] - nr) * 0.3;
      const eg = (oldRgb[1] - ng) * 0.3;
      const eb = (oldRgb[2] - nb) * 0.3;
      const spread = (dx, dy, f) => {
        if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) {
          const j = ((y + dy) * w + (x + dx)) * 4;
          d[j] = Math.max(0, Math.min(255, d[j] + er * f));
          d[j + 1] = Math.max(0, Math.min(255, d[j + 1] + eg * f));
          d[j + 2] = Math.max(0, Math.min(255, d[j + 2] + eb * f));
        }
      };
      spread(1, 0, 7 / 16);
      spread(-1, 1, 3 / 16);
      spread(0, 1, 5 / 16);
      spread(1, 1, 1 / 16);
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// ——— 5. NOISE CLEANUP ———
function cleanupIsolatedPixels(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  function getColor(x, y) {
    const i = (y * w + x) * 4;
    return `${d[i]},${d[i + 1]},${d[i + 2]}`;
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const center = getColor(x, y);
      const neighbors = [
        getColor(x - 1, y),
        getColor(x + 1, y),
        getColor(x, y - 1),
        getColor(x, y + 1),
      ];
      const same = neighbors.filter((n) => n === center).length;
      if (same === 0) {
        const counts = {};
        neighbors.forEach((n) => {
          counts[n] = (counts[n] || 0) + 1;
        });
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        const [r, g, b] = best.split(",").map(Number);
        const i = (y * w + x) * 4;
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// ——— 6. GRID RENDER ———
function renderFlatGrid(ctx, w, h, scale) {
  const src = ctx.getImageData(0, 0, w, h).data;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const c = canvas.getContext("2d");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = src[i],
        g = src[i + 1],
        b = src[i + 2];
      c.fillStyle = `rgb(${r},${g},${b})`;
      c.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas;
}

function renderDiamondGrid(ctx, w, h, scale) {
  const src = ctx.getImageData(0, 0, w, h).data;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const c = canvas.getContext("2d");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = src[i],
        g = src[i + 1],
        b = src[i + 2];
      c.fillStyle = `rgb(${r},${g},${b})`;
      c.fillRect(x * scale, y * scale, scale, scale);
      c.fillStyle = "rgba(255,255,255,0.15)";
      c.fillRect(x * scale, y * scale, scale, scale / 3);
      c.fillStyle = "rgba(0,0,0,0.15)";
      c.fillRect(x * scale, y * scale + scale * 0.66, scale, scale / 3);
      c.fillRect(x * scale + scale * 0.66, y * scale, scale / 3, scale);
    }
  }
  return canvas;
}

// Top view of pyramid: central diamond (apex) highlight, corner triangles (sides) darker
function renderFlatDiamondGrid(ctx, w, h, scale) {
  const src = ctx.getImageData(0, 0, w, h).data;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const c = canvas.getContext("2d");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = src[i],
        g = src[i + 1],
        b = src[i + 2];
      const px = x * scale;
      const py = y * scale;
      const cx = px + scale / 2;
      const cy = py + scale / 2;
      const half = scale * 0.4; // diamond size (top face of pyramid)
      c.fillStyle = `rgb(${r},${g},${b})`;
      c.fillRect(px, py, scale, scale);
      // Darken four corner triangles (pyramid sides)
      c.fillStyle = "rgba(0,0,0,0.12)";
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(cx - half, cy);
      c.lineTo(cx, cy - half);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(px + scale, py);
      c.lineTo(cx + half, cy);
      c.lineTo(cx, cy - half);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(px + scale, py + scale);
      c.lineTo(cx + half, cy);
      c.lineTo(cx, cy + half);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(px, py + scale);
      c.lineTo(cx - half, cy);
      c.lineTo(cx, cy + half);
      c.closePath();
      c.fill();
      // Central diamond = top face of pyramid (highlight)
      c.fillStyle = "rgba(255,255,255,0.25)";
      c.beginPath();
      c.moveTo(cx, cy - half);
      c.lineTo(cx + half, cy);
      c.lineTo(cx, cy + half);
      c.lineTo(cx - half, cy);
      c.closePath();
      c.fill();
    }
  }
  return canvas;
}

// ——— 7. ENTRY POINT ———
function createDiamondArt(img, gridW, gridH, scale, maxColors, options) {
  const canvas = document.createElement("canvas");
  canvas.width = gridW;
  canvas.height = gridH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, gridW, gridH);
  if (options && options.preProcess !== false) {
    enhanceImage(ctx, gridW, gridH, {
      contrastIntensity: options.contrastIntensity,
      saturation: options.saturation,
    });
  }
  const stylePalette =
    options && options.style && getStylePalette(options.style);
  const palette =
    stylePalette || getReducedPalette(maxColors || PALETTE.length);
  applyDiamondQuantization(ctx, gridW, gridH, palette);
  if (options && options.runCleanup) {
    cleanupIsolatedPixels(ctx, gridW, gridH);
  }
  if (options && options.renderGrid === false) {
    return renderFlatGrid(ctx, gridW, gridH, scale);
  }
  if (options && options.gridStyle === "flatDiamond") {
    return renderFlatDiamondGrid(ctx, gridW, gridH, scale);
  }
  return renderDiamondGrid(ctx, gridW, gridH, scale);
}

if (typeof window !== "undefined") {
  window.createDiamondArt = createDiamondArt;
}
