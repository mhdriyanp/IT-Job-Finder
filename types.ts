export interface Job {
  id: string;
  title: string;
  company: string;
  logo: string;
  location: string;
  experience: string;
  salary: string;
  skills: string[];
  tags: string[];
  description: string;
  postedAt: string;
  createdAt: number; // timestamp
  minSalary: number; // in LPA
  maxSalary: number; // in LPA
  website?: string;
  isSaved?: boolean;
}

export interface UserProfile {
  name: string;
  photo: string;
  qualification: string;
  skills: string[];
  appliedCount: number;
  appliedJobIds: string[];
  matchPercentage: number;
}

export type Screen = 'home' | 'saved' | 'profile' | 'details' | 'filters';
