/**
 * Cloud project storage via Supabase.
 * Table: projects (id uuid, user_id uuid, name text, data jsonb, created_at timestamptz, updated_at timestamptz)
 */

import { supabase } from '../lib/supabase';
import { useElementStore } from '../store/elementStore';
import { usePlaybackStore } from '../store/playbackStore';
import { useTimelineStore } from '../store/timelineStore';

export interface CloudProject {
  id: string;
  name: string;
  updated_at: string;
  created_at: string;
}

export async function listCloudProjects(): Promise<CloudProject[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, updated_at, created_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to list cloud projects:', error);
    return [];
  }
  return data || [];
}

export async function saveProjectToCloud(name?: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const elements = useElementStore.getState().elements;
  const duration = usePlaybackStore.getState().duration;
  const tracks = useTimelineStore.getState().tracks;

  const projectData = { elements, duration, tracks, version: 1 };

  const { data, error } = await supabase
    .from('projects')
    .upsert({
      user_id: user.id,
      name: name || 'Untitled Project',
      data: projectData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save to cloud:', error);
    return null;
  }
  return data?.id || null;
}

export async function loadProjectFromCloud(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('id', id)
    .single();

  if (error || !data?.data) {
    console.error('Failed to load cloud project:', error);
    return false;
  }

  const project = data.data as { elements: any[]; duration: number; tracks: any[] };

  if (project.elements?.length) {
    useElementStore.getState().setElements(project.elements);
  }
  if (project.duration) {
    usePlaybackStore.getState().setDuration(project.duration);
  }
  if (project.tracks) {
    useTimelineStore.setState({ tracks: project.tracks });
  }

  return true;
}

export async function deleteProjectFromCloud(id: string): Promise<boolean> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete cloud project:', error);
    return false;
  }
  return true;
}
