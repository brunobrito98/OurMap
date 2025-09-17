interface CategoryFilterProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const categories = [
  { value: "", label: "Populares", icon: "fas fa-fire" },
  { value: "music", label: "Música", icon: "fas fa-music" },
  { value: "food", label: "Gastronomia", icon: "fas fa-utensils" },
  { value: "sports", label: "Esportes", icon: "fas fa-running" },
  { value: "art", label: "Arte", icon: "fas fa-palette" },
  { value: "tech", label: "Tecnologia", icon: "fas fa-laptop-code" },
];

export default function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <div>
      <h3 className="font-semibold text-foreground mb-3">Categorias</h3>
      <div className="flex space-x-3 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.value}
            onClick={() => onCategoryChange(category.value)}
            className={`category-chip px-4 py-2 rounded-full whitespace-nowrap font-medium text-sm transition-all duration-200 hover:transform hover:-translate-y-1 ${
              selectedCategory === category.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground'
            }`}
            data-testid={`button-category-${category.value || 'popular'}`}
          >
            <i className={`${category.icon} mr-2`}></i>
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
}
