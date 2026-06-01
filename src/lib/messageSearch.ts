/** Returns true if a message's content matches the query (case-insensitive substring). */
export function messageMatchesQuery(content: string, query: string): boolean {
  return content.toLowerCase().includes(query.toLowerCase())
}
