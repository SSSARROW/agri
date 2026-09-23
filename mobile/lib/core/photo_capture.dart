import 'dart:io';

import 'package:image_picker/image_picker.dart';

/// Always the live camera, never the gallery (ImageSource.camera) — a
/// field photo is meant as evidence something happened at that place and
/// time, which an old or unrelated gallery picture wouldn't be.
class PhotoCapture {
  static final _picker = ImagePicker();

  static Future<File?> takePhoto() async {
    final shot = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1600,
      imageQuality: 85,
    );
    if (shot == null) return null;
    return File(shot.path);
  }
}
