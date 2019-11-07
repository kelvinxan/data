class Transformer<Src, Dest> {
  constructor(
    private source: Src[][],
    private fn: (dv: Src[]) => Dest,
    private cache: Dest[] = []
  ) {}

  get(id: number) {
    let v = this.cache[id];
    if (v !== undefined) {
      return v;
    }

    const sources = [];
    for (const source of this.source) {
      if (source === null) continue;
      const dv = source[id];
      if (dv === undefined) {
        throw new Error(`Cannot resolve ${id}`);
      }
      sources.push(dv);
    }

    v = this.fn(sources);
    this.cache[id] = v;
    return v;
  }

  *[Symbol.iterator]() {
    let length = 0;
    for (const source of this.source) {
      if (source !== null) {
        // For now, assume all that sources have the same length
        length = source.length;
        break;
      }
    }

    for (let i = 0; i < length; i++) {
      yield this.get(i);
    }
  }
}

function assignRemap(remap: Record<string, symbol>, dest: any, srcs: any[]) {
  for (const src of srcs) {
    for (const k in src) {
      if (k in remap) {
        dest[remap[k]] = src[k];
      } else {
        dest[k] = src[k];
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////

export default class Dex {
  gens: Transformer<any, any>;
  constructor(dexSrc: any[]) {
    const genSrc: any[] = [];
    this.gens = new Transformer(genSrc, (gen: any[]) => new Generation(gen));
    for (const dex of dexSrc) {
      genSrc.push(dex.gens);
    }
  }
}

////////////////////////////////////////////////////////////////////////////////

class Generation {
  species: Transformer<any, any>;
  abilities: Transformer<any, any>;
  items: Transformer<any, any>;
  moves: Transformer<any, any>;
  types: Transformer<any, any>;
  [k: string]: unknown;

  constructor(genSrc: any[]) {
    // Explicitly relying on the ability to mutate this before accessing a
    // transformer element
    const speciesSrc: any[] = [];
    const abilitiesSrc: any[] = [];
    const itemsSrc: any[] = [];
    const movesSrc: any[] = [];
    const typesSrc: any[] = [];

    this.species = new Transformer(speciesSrc, (specie: any[]) => new Species(this, specie));
    this.abilities = new Transformer(abilitiesSrc, (ability: any[]) => new Ability(this, ability));
    this.items = new Transformer(itemsSrc, (item: any[]) => new Item(this, item));
    this.moves = new Transformer(movesSrc, (move: any[]) => new Move(this, move));
    this.types = new Transformer(typesSrc, (type: any[]) => new Type(this, type));

    // Can we abstract this logic into assignRemap?
    for (const gen of genSrc) {
      for (const k in gen) {
        switch (k) {
          case 'species':
            speciesSrc.push(gen[k]);
            break;
          case 'abilities':
            abilitiesSrc.push(gen[k]);
            break;
          case 'items':
            itemsSrc.push(gen[k]);
            break;
          case 'moves':
            movesSrc.push(gen[k]);
            break;
          case 'types':
            typesSrc.push(gen[k]);
            break;
          default:
            this[k] = gen[k];
            break;
        }
      }
    }
  }
}

class GenerationalBase {
  constructor(public gen: Generation) {}
}

////////////////////////////////////////////////////////////////////////////////

const prevoSym = Symbol();
const evosSym = Symbol();
const abilitiesSym = Symbol();
const typesSym = Symbol();
const learnsetSym = Symbol();

class SpeciesBase extends GenerationalBase {
  private [prevoSym]: number | null | undefined;
  private [evosSym]: number[] | undefined;
  private [abilitiesSym]: number[] | undefined;
  private [typesSym]: number[] | undefined;
  private [learnsetSym]: number[] | undefined;

  get prevo() {
    const v = this[prevoSym];
    if (v === undefined) throw new Error('prevo not loaded yet');
    if (v === null) return null;
    return this.gen.species.get(v);
  }

  get evos() {
    const v = this[evosSym];
    if (v === undefined) throw new Error('evos not loaded yet');
    return v.map(id => this.gen.species.get(id));
  }

  get abilities() {
    const v = this[abilitiesSym];
    if (v === undefined) throw new Error('abilities not loaded yet');
    return v.map(id => this.gen.abilities.get(id));
  }

  get types() {
    const v = this[typesSym];
    if (v === undefined) throw new Error('types not loaded yet');
    return v.map(id => this.gen.types.get(id));
  }

  get learnset() {
    const v = this[learnsetSym];
    if (v === undefined) throw new Error('learnset not loaded yet');
    return v.map(id => this.gen.moves.get(id));
  }
}

class Species extends SpeciesBase {
  [k: string]: unknown;

  constructor(gen: Generation, specie: any[]) {
    super(gen);
    assignRemap(
      {
        prevo: prevoSym,
        evos: evosSym,
        abilities: abilitiesSym,
        types: typesSym,
        learnset: learnsetSym,
      },
      this,
      specie
    );
  }
}

////////////////////////////////////////////////////////////////////////////////

class Ability extends GenerationalBase {
  [k: string]: unknown;

  constructor(gen: Generation, ability: any[]) {
    super(gen);
    assignRemap({}, this, ability);
  }
}

////////////////////////////////////////////////////////////////////////////////

class Item extends GenerationalBase {
  [k: string]: unknown;

  constructor(gen: Generation, item: any[]) {
    super(gen);
    assignRemap({}, this, item);
  }
}

////////////////////////////////////////////////////////////////////////////////

const typeSym = Symbol();

class MoveBase extends GenerationalBase {
  private [typeSym]: number | undefined;

  get type() {
    const v = this[typeSym];
    if (v === undefined) throw new Error('type not loaded yet');
    return this.gen.types.get(v);
  }
}

class Move extends MoveBase {
  [k: string]: unknown;

  constructor(gen: Generation, move: any) {
    super(gen);
    assignRemap({ type: typeSym }, this, move);
  }
}

////////////////////////////////////////////////////////////////////////////////

class Type extends GenerationalBase {
  [k: string]: unknown;

  constructor(gen: Generation, type: any) {
    super(gen);
    assignRemap({}, this, type);
  }
}
