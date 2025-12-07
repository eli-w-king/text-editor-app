import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

const NOTES_STORAGE_KEY = 'notes_data';

export const useNotes = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    try {
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      if (storedNotes) {
        setNotes(JSON.parse(storedNotes));
      }
    } catch (e) {
      console.error('Failed to load notes', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const saveNote = async (note: Note) => {
    try {
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      let currentNotes: Note[] = storedNotes ? JSON.parse(storedNotes) : [];
      
      const existingIndex = currentNotes.findIndex(n => n.id === note.id);
      if (existingIndex >= 0) {
        currentNotes[existingIndex] = note;
      } else {
        currentNotes.unshift(note); // Add to top
      }
      
      // Sort by updatedAt desc
      currentNotes.sort((a, b) => b.updatedAt - a.updatedAt);

      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(currentNotes));
      setNotes(currentNotes);
    } catch (e) {
      console.error('Failed to save note', e);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      if (storedNotes) {
        let currentNotes: Note[] = JSON.parse(storedNotes);
        currentNotes = currentNotes.filter(n => n.id !== id);
        await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(currentNotes));
        setNotes(currentNotes);
      }
    } catch (e) {
      console.error('Failed to delete note', e);
    }
  };

  return { notes, loading, loadNotes, saveNote, deleteNote };
};
