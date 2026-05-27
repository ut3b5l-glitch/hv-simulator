import { promises as fs } from "fs";
import path from "path";
import type {
  Meeting,
  MeetingsIndex,
  Performance,
  Profiles,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

async function readJson<T>(rel: string): Promise<T> {
  const buf = await fs.readFile(path.join(DATA_DIR, rel), "utf-8");
  return JSON.parse(buf) as T;
}

export async function getMeetingsIndex(): Promise<MeetingsIndex> {
  return readJson<MeetingsIndex>("meetings.json");
}

export async function getMeeting(date: string): Promise<Meeting> {
  return readJson<Meeting>(path.join("meetings", `${date}.json`));
}

export async function getLatestMeeting(): Promise<Meeting | null> {
  try {
    const idx = await getMeetingsIndex();
    if (!idx.meetings.length) return null;
    return getMeeting(idx.meetings[0].date);
  } catch {
    return null;
  }
}

export async function getPerformance(): Promise<Performance | null> {
  try {
    return await readJson<Performance>("performance.json");
  } catch {
    return null;
  }
}

export async function getProfiles(): Promise<Profiles | null> {
  try {
    return await readJson<Profiles>("profiles.json");
  } catch {
    return null;
  }
}
