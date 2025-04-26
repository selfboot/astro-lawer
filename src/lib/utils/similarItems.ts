import type { CollectionEntry } from "astro:content";

// Helper function to safely parse and compare dates (newest first)
const sortByDateDesc = (a: any, b: any): number => {
  const dateA = new Date(a.data.date);
  const dateB = new Date(b.data.date);
  // Handle invalid dates if necessary, place them at the end
  if (isNaN(dateA.getTime())) return 1;
  if (isNaN(dateB.getTime())) return -1;
  return dateB.getTime() - dateA.getTime();
};

// similer products
const similerItems = (
  currentItem: CollectionEntry<"posts">, // Use CollectionEntry type if possible
  allItems: CollectionEntry<"posts">[],
  id: string,
  maxItems: number = 3, // Allow configuring max items, default to 3
): CollectionEntry<"posts">[] => {
  let categories: string[] = [];
  let tags: string[] = [];

  if (currentItem.data.categories && currentItem.data.categories.length > 0) {
    categories = currentItem.data.categories;
  }

  if (currentItem.data.tags && currentItem.data.tags.length > 0) {
    tags = currentItem.data.tags;
  }

  // 1. Filter by Tags & Sort by Date
  const filterByTags = allItems
    .filter(
      (item) =>
        item.id !== id && // Exclude current item
        item.data.tags &&
        tags.some((tag) => item.data.tags.includes(tag)),
    )
    .sort(sortByDateDesc);

  // Take up to maxItems based on tags
  const similarPostsByTag = filterByTags.slice(0, maxItems);
  const tagResultIds = new Set(similarPostsByTag.map((p) => p.id)); // Keep track of added IDs

  let finalSimilarPosts = [...similarPostsByTag];

  // 2. If needed, supplement with Category matches
  const needed = maxItems - finalSimilarPosts.length;
  if (needed > 0) {
    // Filter by Categories & Sort by Date
    const filterByCategories = allItems
      .filter(
        (item) =>
          item.id !== id && // Exclude current item
          !tagResultIds.has(item.id) && // Exclude items already found by tag
          item.data.categories &&
          categories.some((category) =>
            item.data.categories.includes(category),
          ),
      )
      .sort(sortByDateDesc);

    // Add needed items from category results
    finalSimilarPosts.push(...filterByCategories.slice(0, needed));
  }

  return finalSimilarPosts;
};

export default similerItems;
