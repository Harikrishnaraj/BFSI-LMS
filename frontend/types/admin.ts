import type { Role } from './index';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Only present in the response to a create. */
  temporaryPassword?: string;
}

export interface DashboardMetrics {
  totalUsers: number;
  activeCourses: number;
  completionRate: number;
  complianceStatus: { compliant: number; atRisk: number; nonCompliant: number };
  certificatesExpiringSoon: number;
  lastUpdate: string;
}

export interface CourseCompliance {
  id: string;
  title: string;
  category: string | null;
  assigned: number;
  completed: number;
  completionRate: number;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: 'success' | 'failure';
  error_message: string | null;
  details: unknown;
  request_id: string | null;
  timestamp: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type CourseStatus = 'draft' | 'published' | 'archived';
export type ContentType = 'video' | 'pdf' | 'richtext' | 'scorm';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: CourseStatus;
  isMandatory: boolean;
  complianceType: string | null;
  targetAudience: string | null;
  difficulty: Difficulty;
  version: number;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string } | null;
  _count: { enrollments: number; content: number };
}

export interface CourseContentItem {
  id: string;
  courseId: string;
  contentType: ContentType;
  title: string;
  description: string | null;
  fileUrl: string | null;
  contentText: string | null;
  orderIndex: number;
}

export interface CourseDetail extends CourseSummary {
  content: CourseContentItem[];
  assessments: unknown[];
}

export interface PublishCheck {
  key: string;
  label: string;
  required: boolean;
  passed: boolean;
}

export interface InstructorMetrics {
  myCourses: number;
  totalStudents: number;
  activeLearners: number;
  avgCompletion: number;
}

export interface CourseEnrollment {
  enrollment_id: string;
  user: { id: string; name: string; email: string; department: string | null };
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  progress_percentage: number;
  time_spent: number;
  enrolled_at: string;
  completed_at: string | null;
}

export type ApiEnrollmentStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';
export type CertificateState = 'active' | 'expiring_soon' | 'expired';

export interface LearnerCertificate {
  id: string;
  course: { id: string; title: string; complianceType?: string | null };
  issued_at: string;
  expires_at: string | null;
  state: CertificateState;
}

export interface LearnerDashboard {
  coursesInProgress: number;
  coursesCompleted: number;
  learningHours: number;
  activeCertificates: number;
  mandatoryCourses: {
    enrollmentId: string;
    course: { id: string; title: string; category: string | null; isMandatory: boolean };
    status: ApiEnrollmentStatus;
    progress_percentage: number;
    due_at: string | null;
    overdue: boolean;
  }[];
  certificates: LearnerCertificate[];
  continueCourseId: string | null;
}

export interface MyEnrollment {
  enrollmentId: string;
  course_id: string;
  status: ApiEnrollmentStatus;
  progress_percentage: number;
  time_spent_seconds: number;
}

export interface Lesson {
  id: string;
  title: string;
  description: string | null;
  type: ContentType;
  fileUrl: string | null;
  contentText: string | null;
  orderIndex: number;
  completed_at: string | null;
}

export interface CourseProgress {
  enrollmentId: string;
  course_id: string;
  progress_percentage: number;
  time_spent_seconds: number;
  status: ApiEnrollmentStatus;
  completed_at: string | null;
  lessons_completed: number;
  total_lessons: number;
}
