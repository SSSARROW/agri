import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface FarmerSignupPayload {
  email: string;
  password: string;
  name: string;
  phone: string;
  nic: string;
  district: string;
  dsd: string;
  gn_division: string;
  farm_address: string;
  farm_size_ha: number;
}

export interface ExporterSignupPayload {
  email: string;
  password: string;
  name: string;
  phone: string;
  business_name: string;
  business_reg_no: string;
  business_address: string;
  export_license_no: string;
}

export interface AuthResponse {
  access_token: string;
  token_type?: string;
  role: "admin" | "farmer" | "exporter";
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: "admin" | "farmer" | "exporter";
  phone?: string;
  district?: string;
  business_name?: string;
  [key: string]: any;
}

export const getAuthToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
};

export const setAuthToken = (token: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
  }
};

export const clearAuthToken = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
  }
};

export const loginUser = async (data: { email: string; password: string }): Promise<AuthResponse> => {
  const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/login`, data);
  if (response.data.access_token) {
    setAuthToken(response.data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("role", response.data.role);
    }
  }
  return response.data;
};

export const signupFarmer = async (data: FarmerSignupPayload): Promise<AuthResponse> => {
  const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/signup/farmer`, data);
  if (response.data.access_token) {
    setAuthToken(response.data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("role", response.data.role);
    }
  }
  return response.data;
};

export const signupExporter = async (data: ExporterSignupPayload): Promise<AuthResponse> => {
  const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/signup/exporter`, data);
  if (response.data.access_token) {
    setAuthToken(response.data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("role", response.data.role);
    }
  }
  return response.data;
};

export const getGoogleAuthUrl = async (): Promise<string> => {
  const response = await axios.get<{ url: string }>(`${API_BASE_URL}/auth/google`);
  return response.data.url;
};

export const fetchUserProfile = async (token?: string): Promise<UserProfile> => {
  const authToken = token || getAuthToken();
  if (!authToken) {
    throw new Error("No authorization token found");
  }
  const response = await axios.get<UserProfile>(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  return response.data;
};

export const auth = {
  isLoggedIn: (): boolean => {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("token");
    }
    return false;
  },
  role: (): string | null => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("role");
    }
    return null;
  },
  token: (): string | null => getAuthToken(),
  clear: (): void => clearAuthToken(),
  setToken: (token: string, role?: string): void => {
    setAuthToken(token);
    if (role && typeof window !== "undefined") {
      localStorage.setItem("role", role);
    }
  },
  login: loginUser,
  signupFarmer,
  signupExporter,
  getGoogleAuthUrl,
  fetchUserProfile,
};
