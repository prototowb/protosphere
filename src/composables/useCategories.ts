import { backend } from '@/lib/backend'
import { useCategoriesStore } from '@/stores/categories'

export function useCategories() {
  const categoriesStore = useCategoriesStore()

  async function fetchCategories(serverId: string) {
    categoriesStore.categories = await backend.categories.list(serverId)
  }

  async function createCategory(serverId: string, name: string) {
    const category = await backend.categories.create({ server_id: serverId, name })
    categoriesStore.categories.push(category)
    return category
  }

  async function deleteCategory(id: string) {
    await backend.categories.delete(id)
    categoriesStore.categories = categoriesStore.categories.filter((c) => c.id !== id)
  }

  return { fetchCategories, createCategory, deleteCategory }
}
