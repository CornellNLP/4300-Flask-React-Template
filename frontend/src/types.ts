export interface Recipe {
    name: String,
    minutes: Number,
    tags: String[],
    n_steps: Number,
    steps: String[],
    description: String,
    n_ingredients: Number,
    ingredients: String[]
}