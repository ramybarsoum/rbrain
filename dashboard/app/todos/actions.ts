'use server';

import { revalidatePath } from 'next/cache';
import { upsertTodo, deletePage } from '@/lib/operations';

function todoSlug() {
  return `todos/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createTodo(formData: FormData) {
  const title = (formData.get('title') as string | null)?.trim();
  if (!title) return;
  const priority = (formData.get('priority') as string) || 'p2';
  const due_date = (formData.get('due_date') as string) || undefined;
  await upsertTodo(todoSlug(), { title, done: false, priority, due_date });
  revalidatePath('/todos');
  revalidatePath('/daily');
}

export async function toggleTodo(slug: string, done: boolean, title: string, priority: string, due_date?: string) {
  await upsertTodo(slug, { title, done, priority, due_date });
  revalidatePath('/todos');
  revalidatePath('/daily');
}

export async function removeTodo(slug: string) {
  await deletePage(slug);
  revalidatePath('/todos');
  revalidatePath('/daily');
}
