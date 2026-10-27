import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { mockRecipes } from '../data/mockData';

// T-17/T-18 (Paprika import -> dinner menu). Meal planning (picking which
// recipe goes on which day) is deliberately NOT built here -- the backlog's
// own "add to meal plan + grocery list" idea never got designed (what a
// plan even looks like, whether it needs its own calendar), so this ships
// the well-scoped half: browse recipes, see ingredients/directions, and
// push a recipe's ingredients straight into the existing Groceries list
// (reusing addTaskLive, the same action GroceriesPage itself uses -- no new
// Sheets/Tasks plumbing needed for that part).
export default function DinnerPage() {
  const { recipes, recipesLive, addTaskLive } = useApp();
  const [openName, setOpenName] = useState(null);
  const [addedName, setAddedName] = useState(null);

  const list = recipesLive ? recipes : mockRecipes;

  const addIngredientsToGroceries = async (recipe) => {
    for (const ingredient of recipe.ingredients) {
      // Sequential, not Promise.all -- Google Tasks' insertTask has no
      // documented bulk-insert endpoint, and firing a dozen+ concurrent
      // writes against the same list risks hitting a rate limit for no
      // real benefit (a few ingredients land a beat later, unnoticeable
      // on a wall display nobody is staring at mid-add).
      // eslint-disable-next-line no-await-in-loop
      await addTaskLive('grocery', ingredient);
    }
    setAddedName(recipe.name);
  };

  return (
    <div className="page active" id="page-dinner" style={{ flexDirection: 'column', padding: '1.2em 1.6em', gap: '0.8em', overflowY: 'auto' }}>
      {!recipesLive && (
        <div
          style={{
            padding: '0.5em 0.8em', borderRadius: 'var(--card-radius)', background: 'var(--bg-card)',
            fontSize: '0.78em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5em',
          }}
        >
          <span>🔧</span>
          <span>
            Showing example recipes — real ones show up here once Trey emails in a Paprika export
            (labeled "Paprika Import"; see apps-script/README.md). Nothing below is live yet.
          </span>
        </div>
      )}

      {list.map((recipe) => {
        const open = openName === recipe.name;
        return (
          <div key={recipe.name} style={{ background: 'var(--bg-card)', borderRadius: 'var(--card-radius)', padding: '0.8em 1em' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8em', cursor: 'pointer' }} onClick={() => setOpenName(open ? null : recipe.name)}>
              <span style={{ fontSize: '1.4em' }}>🍽️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'var(--font-weight-heading)' }}>{recipe.name}</div>
                <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>
                  {[recipe.prepTime && `Prep ${recipe.prepTime}`, recipe.cookTime && `Cook ${recipe.cookTime}`, recipe.servings && `Serves ${recipe.servings}`]
                    .filter(Boolean).join(' · ')}
                </div>
              </div>
              {!!recipe.categories?.length && (
                <div style={{ display: 'flex', gap: '0.3em', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {recipe.categories.map((c) => <span key={c} className="fpill" style={{ fontSize: '0.72em' }}>{c}</span>)}
                </div>
              )}
              <span style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
            </div>

            {open && (
              <div style={{ marginTop: '0.8em', display: 'flex', gap: '1.5em', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 14em', minWidth: '12em' }}>
                  <div className="filter-section-label">Ingredients</div>
                  <ul style={{ margin: '0.3em 0 0', paddingLeft: '1.2em', fontSize: '0.85em' }}>
                    {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                  </ul>
                  <button className="add-btn" style={{ marginTop: '0.6em' }} onClick={() => addIngredientsToGroceries(recipe)}>
                    Add ingredients to Groceries
                  </button>
                  {addedName === recipe.name && (
                    <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginTop: '0.3em' }}>Added to the Grocery list.</div>
                  )}
                </div>
                <div style={{ flex: '2 1 18em', minWidth: '14em' }}>
                  <div className="filter-section-label">Directions</div>
                  <div style={{ marginTop: '0.3em', fontSize: '0.85em', whiteSpace: 'pre-wrap' }}>{recipe.directions || '—'}</div>
                  {!!recipe.notes && (
                    <div style={{ marginTop: '0.6em', fontSize: '0.78em', color: 'var(--text-muted)' }}>Note: {recipe.notes}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
