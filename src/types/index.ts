export type TaskStatus = "pending" | "processing" | "completed" | "failed"

export interface TranscriptSegment {
  id: string
  speaker: string
  startTime: number
  endTime: number
  text: string
}

export interface Summary {
  overview: string
  keyPoints: string[]
  actionItems?: string[]
}

export interface Task {
  id: string
  title: string
  duration: number
  status: TaskStatus
  createdAt: Date
  updatedAt: Date
  fileType: "audio" | "video" | "youtube"
  fileSize?: number
  progress?: number
  transcript?: TranscriptSegment[]
  summary?: Summary
}

export interface User {
  id: string
  name: string
  email: string
  image?: string
}
