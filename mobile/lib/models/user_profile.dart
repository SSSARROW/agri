class UserProfile {
  final String id;
  final String email;
  final String? name;
  final String? phone;
  final String role;
  final String? district;
  final String? dsd;
  final String? gnDivision;
  final String? businessName;

  UserProfile({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
    required this.role,
    required this.district,
    required this.dsd,
    required this.gnDivision,
    required this.businessName,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
    id: json['id'] as String,
    email: json['email'] as String,
    name: json['name'] as String?,
    phone: json['phone'] as String?,
    role: json['role'] as String,
    district: json['district'] as String?,
    dsd: json['dsd'] as String?,
    gnDivision: json['gn_division'] as String?,
    businessName: json['business_name'] as String?,
  );
}
