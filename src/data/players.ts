import type { Player } from '../engine/types'
import fc26 from './generated/player_ratings.json'

/**
 * Shared player database for every knockout-stage squad, keyed by player id.
 * Each player is defined exactly once and referenced by id from matches.ts,
 * so teams that appear in several rounds reuse the same ratings object.
 *
 * Ratings are FC24-style 1-99 judgment calls, not official values. England
 * and Mexico keep the ratings the app shipped with.
 */

const p = (
  id: string,
  name: string,
  shirtNumber: number,
  position: Player['ratings']['position'],
  pace: number,
  shooting: number,
  passing: number,
  defending: number,
  physical: number,
): Player => ({ id, name, shirtNumber, ratings: { pace, shooting, passing, defending, physical, position } })

const ALL: Player[] = [
  // ── England (ratings unchanged from the original build) ──────────────────
  p('eng-pickford', 'Pickford', 1, 'GK', 54, 24, 74, 86, 80),
  p('eng-quansah', 'Quansah', 6, 'DEF', 79, 34, 72, 83, 85),
  p('eng-konsa', 'Konsa', 2, 'DEF', 81, 31, 74, 84, 80),
  p('eng-guehi', 'Guéhi', 5, 'DEF', 77, 33, 75, 85, 82),
  p('eng-oreilly', "O'Reilly", 3, 'DEF', 82, 58, 81, 78, 76),
  p('eng-anderson', 'Anderson', 8, 'MID', 78, 72, 82, 74, 79),
  p('eng-rice', 'Rice', 4, 'MID', 78, 71, 85, 87, 86),
  p('eng-bellingham', 'Bellingham', 10, 'MID', 84, 88, 88, 79, 88),
  p('eng-saka', 'Saka', 7, 'FWD', 88, 86, 84, 62, 71),
  p('eng-gordon', 'Gordon', 11, 'FWD', 92, 80, 78, 54, 68),
  p('eng-kane', 'Kane', 9, 'FWD', 68, 93, 85, 48, 83),
  p('eng-trafford', 'Trafford', 13, 'GK', 50, 21, 68, 80, 75),
  p('eng-mainoo', 'Mainoo', 16, 'MID', 75, 71, 84, 76, 80),
  p('eng-rogers', 'Rogers', 19, 'MID', 81, 77, 80, 58, 75),
  p('eng-madueke', 'Madueke', 17, 'FWD', 90, 79, 74, 45, 67),
  p('eng-stones', 'Stones', 15, 'DEF', 76, 40, 84, 86, 80),
  p('eng-eze', 'Eze', 14, 'MID', 85, 80, 82, 50, 68),
  p('eng-rashford', 'Rashford', 20, 'FWD', 90, 82, 76, 42, 74),

  // ── Mexico (ratings unchanged from the original build) ────────────────────
  p('mex-rangel', 'Rangel', 13, 'GK', 49, 22, 63, 81, 76),
  p('mex-sanchez', 'Sanchez', 2, 'DEF', 80, 45, 72, 78, 74),
  p('mex-montes', 'Montes', 3, 'DEF', 71, 41, 68, 82, 85),
  p('mex-vasquez', 'Vasquez', 5, 'DEF', 68, 38, 67, 80, 81),
  p('mex-gallardo', 'Gallardo', 23, 'DEF', 81, 55, 75, 76, 73),
  p('mex-lira', 'Lira', 16, 'MID', 73, 58, 77, 79, 78),
  p('mex-mora', 'Mora', 14, 'MID', 77, 68, 82, 68, 70),
  p('mex-romo', 'Romo', 6, 'MID', 71, 66, 78, 72, 76),
  p('mex-alvarado', 'Alvarado', 26, 'FWD', 85, 78, 79, 48, 62),
  p('mex-jimenez', 'Jimenez', 9, 'FWD', 66, 84, 74, 42, 81),
  p('mex-quinones', 'Quinones', 24, 'FWD', 89, 74, 70, 50, 72),
  p('mex-reyes', 'Reyes', 15, 'DEF', 76, 40, 69, 79, 78),
  p('mex-gutierrez', 'Gutierrez', 18, 'MID', 69, 62, 80, 70, 72),
  p('mex-vargas', 'Vargas', 11, 'FWD', 83, 76, 68, 44, 70),
  p('mex-chavez', 'Chavez', 7, 'MID', 74, 73, 81, 66, 74),

  // ── France ────────────────────────────────────────────────────────────────
  p('fra-maignan', 'Maignan', 16, 'GK', 55, 25, 76, 89, 84),
  p('fra-risser', 'Risser', 23, 'GK', 50, 20, 65, 78, 80),
  p('fra-samba', 'Samba', 1, 'GK', 48, 20, 62, 80, 83),
  p('fra-kounde', 'Koundé', 5, 'DEF', 84, 40, 78, 86, 78),
  p('fra-upamecano', 'Upamecano', 4, 'DEF', 82, 35, 74, 86, 88),
  p('fra-saliba', 'Saliba', 17, 'DEF', 83, 33, 76, 88, 85),
  p('fra-digne', 'Digne', 22, 'DEF', 78, 55, 80, 79, 74),
  p('fra-gusto', 'Gusto', 3, 'DEF', 84, 42, 76, 80, 77),
  p('fra-kone', 'Koné', 13, 'MID', 80, 65, 84, 78, 82),
  p('fra-rabiot', 'Rabiot', 14, 'MID', 76, 74, 83, 78, 84),
  p('fra-tchouameni', 'Tchouaméni', 8, 'MID', 74, 70, 82, 85, 86),
  p('fra-zaire-emery', 'Zaïre-Emery', 18, 'MID', 79, 70, 83, 74, 76),
  p('fra-dembele', 'Dembélé', 11, 'FWD', 92, 90, 88, 45, 72),
  p('fra-olise', 'Olise', 7, 'FWD', 84, 85, 88, 48, 70),
  p('fra-barcola', 'Barcola', 21, 'FWD', 92, 80, 79, 40, 68),
  p('fra-mbappe', 'Mbappé', 10, 'FWD', 96, 93, 84, 38, 80),
  p('fra-doue', 'Doué', 20, 'FWD', 87, 82, 85, 42, 66),
  p('fra-akliouche', 'Akliouche', 26, 'FWD', 83, 76, 84, 44, 64),

  // ── Paraguay ──────────────────────────────────────────────────────────────
  p('par-gill', 'Gill', 1, 'GK', 52, 20, 62, 80, 76),
  p('par-fernandez', 'Fernández', 12, 'GK', 48, 18, 58, 74, 72),
  p('par-caceres', 'Cáceres', 2, 'DEF', 74, 32, 66, 79, 80),
  p('par-velazquez', 'Velázquez', 3, 'DEF', 68, 30, 62, 78, 82),
  p('par-g-gomez', 'G. Gómez', 4, 'DEF', 70, 33, 68, 81, 83),
  p('par-alderete', 'Alderete', 5, 'DEF', 69, 34, 64, 80, 84),
  p('par-alonso', 'Alonso', 15, 'DEF', 77, 40, 70, 76, 74),
  p('par-almiron', 'Almirón', 10, 'MID', 84, 74, 78, 52, 66),
  p('par-d-gomez', 'D. Gómez', 16, 'MID', 76, 60, 74, 68, 70),
  p('par-cubas', 'Cubas', 6, 'MID', 70, 45, 70, 80, 78),
  p('par-galarza', 'Galarza', 8, 'MID', 74, 58, 75, 66, 70),
  p('par-enciso', 'Enciso', 11, 'FWD', 84, 78, 76, 42, 62),
  p('par-bobadilla', 'Bobadilla', 9, 'FWD', 80, 72, 64, 38, 74),
  p('par-sosa', 'Sosa', 20, 'MID', 75, 62, 73, 60, 68),
  p('par-arce', 'Arce', 18, 'FWD', 82, 70, 66, 40, 63),

  // ── Canada ────────────────────────────────────────────────────────────────
  p('can-crepeau', 'Crépeau', 16, 'GK', 52, 20, 66, 80, 78),
  p('can-goodman', 'Goodman', 1, 'GK', 48, 18, 60, 73, 74),
  p('can-johnston', 'Johnston', 2, 'DEF', 82, 40, 72, 80, 78),
  p('can-bombito', 'Bombito', 4, 'DEF', 84, 30, 66, 81, 84),
  p('can-defougerolles', 'De Fougerolles', 5, 'DEF', 76, 30, 70, 78, 79),
  p('can-laryea', 'Laryea', 22, 'DEF', 84, 45, 71, 74, 73),
  p('can-sigur', 'Sigur', 17, 'DEF', 75, 40, 72, 74, 72),
  p('can-eustaquio', 'Eustáquio', 7, 'MID', 70, 60, 80, 74, 76),
  p('can-buchanan', 'Buchanan', 11, 'FWD', 90, 74, 74, 48, 66),
  p('can-ahmed', 'Ahmed', 20, 'FWD', 85, 68, 72, 44, 62),
  p('can-david', 'David', 9, 'FWD', 84, 86, 74, 40, 74),
  p('can-oluwaseyi', 'Oluwaseyi', 19, 'FWD', 87, 74, 66, 38, 76),
  p('can-p-david', 'P. David', 13, 'DEF', 74, 32, 64, 74, 76),
  p('can-millar', 'Millar', 10, 'FWD', 86, 70, 70, 42, 64),
  p('can-osorio', 'Osorio', 21, 'MID', 78, 66, 79, 56, 62),

  // ── Morocco ───────────────────────────────────────────────────────────────
  p('mar-bounou', 'Bounou', 1, 'GK', 54, 22, 74, 87, 80),
  p('mar-elkajoui', 'El Kajoui', 12, 'GK', 48, 18, 60, 75, 74),
  p('mar-hakimi', 'Hakimi', 2, 'DEF', 93, 72, 82, 82, 78),
  p('mar-halhal', 'Halhal', 20, 'DEF', 80, 36, 70, 77, 74),
  p('mar-diop', 'Diop', 5, 'DEF', 76, 30, 70, 82, 83),
  p('mar-mazraoui', 'Mazraoui', 3, 'DEF', 82, 48, 79, 81, 72),
  p('mar-salaheddine', 'Salah Eddine', 17, 'DEF', 81, 42, 74, 76, 71),
  p('mar-sbai', 'Sbai', 14, 'DEF', 74, 30, 66, 76, 78),
  p('mar-bouaddi', 'Bouaddi', 15, 'MID', 76, 58, 82, 78, 74),
  p('mar-elaynaoui', 'El Aynaoui', 8, 'MID', 75, 68, 80, 74, 80),
  p('mar-ounahi', 'Ounahi', 6, 'MID', 80, 70, 84, 62, 64),
  p('mar-elkhannouss', 'El Khannouss', 10, 'MID', 81, 76, 85, 56, 64),
  p('mar-saibari', 'Saibari', 16, 'MID', 82, 74, 80, 58, 72),
  p('mar-talbi', 'Talbi', 18, 'MID', 74, 56, 74, 76, 76),
  p('mar-elmourabet', 'El Mourabet', 22, 'MID', 73, 55, 72, 64, 68),
  p('mar-brahim', 'Brahim Díaz', 11, 'FWD', 86, 82, 85, 42, 58),
  p('mar-rahimi', 'Rahimi', 7, 'FWD', 84, 78, 68, 40, 74),
  p('mar-yassine', 'Yassine', 19, 'FWD', 80, 68, 66, 42, 66),

  // ── Brazil ────────────────────────────────────────────────────────────────
  p('bra-alisson', 'Alisson', 1, 'GK', 56, 22, 78, 89, 84),
  p('bra-danilo', 'Danilo', 2, 'DEF', 74, 40, 76, 82, 78),
  p('bra-marquinhos', 'Marquinhos', 4, 'DEF', 78, 36, 78, 87, 80),
  p('bra-gabriel', 'Gabriel Magalhães', 6, 'DEF', 74, 38, 72, 87, 87),
  p('bra-douglas', 'Douglas Santos', 16, 'DEF', 78, 44, 76, 79, 76),
  p('bra-bruno', 'Bruno Guimarães', 8, 'MID', 72, 74, 87, 78, 82),
  p('bra-casemiro', 'Casemiro', 5, 'MID', 64, 70, 80, 84, 86),
  p('bra-rayan', 'Rayan', 21, 'FWD', 88, 78, 74, 38, 66),
  p('bra-martinelli', 'Martinelli', 11, 'FWD', 91, 80, 76, 42, 70),
  p('bra-vinicius', 'Vinícius Júnior', 7, 'FWD', 95, 88, 82, 34, 70),
  p('bra-cunha', 'Matheus Cunha', 9, 'FWD', 82, 84, 80, 44, 76),
  p('bra-endrick', 'Endrick', 26, 'FWD', 86, 83, 70, 32, 72),
  p('bra-danilo-santos', 'Danilo Santos', 14, 'DEF', 76, 32, 68, 78, 80),
  p('bra-luiz-henrique', 'Luiz Henrique', 19, 'FWD', 89, 74, 72, 40, 70),
  p('bra-igor-thiago', 'Igor Thiago', 20, 'FWD', 80, 79, 66, 36, 84),

  // ── Norway ────────────────────────────────────────────────────────────────
  p('nor-nyland', 'Nyland', 1, 'GK', 52, 20, 64, 82, 80),
  p('nor-tangvik', 'Tangvik', 12, 'GK', 48, 18, 58, 72, 74),
  p('nor-ryerson', 'Ryerson', 2, 'DEF', 82, 48, 74, 78, 78),
  p('nor-ajer', 'Ajer', 3, 'DEF', 78, 34, 72, 80, 84),
  p('nor-heggem', 'Heggem', 4, 'DEF', 76, 32, 70, 79, 80),
  p('nor-wolfe', 'Møller Wolfe', 5, 'DEF', 83, 44, 73, 76, 74),
  p('nor-berge', 'Berge', 6, 'MID', 72, 62, 80, 78, 84),
  p('nor-odegaard', 'Ødegaard', 10, 'MID', 77, 84, 92, 58, 66),
  p('nor-berg', 'Berg', 8, 'MID', 74, 60, 78, 74, 74),
  p('nor-schjelderup', 'Schjelderup', 15, 'MID', 87, 74, 76, 46, 62),
  p('nor-sorloth', 'Sørloth', 9, 'FWD', 78, 84, 68, 38, 88),
  p('nor-haaland', 'Haaland', 23, 'FWD', 91, 95, 72, 40, 92),
  p('nor-nusa', 'Nusa', 11, 'FWD', 91, 76, 76, 40, 64),
  p('nor-bobb', 'Bobb', 20, 'FWD', 88, 74, 80, 42, 58),
  p('nor-falchener', 'Falchener', 13, 'DEF', 74, 30, 66, 75, 77),
  p('nor-langas', 'Langås', 16, 'DEF', 73, 28, 64, 74, 76),

  // ── Portugal ──────────────────────────────────────────────────────────────
  p('por-costa', 'Diogo Costa', 1, 'GK', 56, 22, 76, 86, 80),
  p('por-sa', 'José Sá', 12, 'GK', 50, 20, 68, 80, 78),
  p('por-cancelo', 'Cancelo', 20, 'DEF', 84, 60, 84, 76, 70),
  p('por-dias', 'Rúben Dias', 4, 'DEF', 74, 34, 76, 89, 86),
  p('por-veiga', 'Renato Veiga', 24, 'DEF', 78, 36, 72, 80, 82),
  p('por-mendes', 'Nuno Mendes', 19, 'DEF', 90, 50, 78, 81, 76),
  p('por-inacio', 'Gonçalo Inácio', 3, 'DEF', 76, 36, 76, 83, 78),
  p('por-neves', 'João Neves', 18, 'MID', 78, 70, 87, 78, 74),
  p('por-vitinha', 'Vitinha', 23, 'MID', 76, 74, 89, 70, 66),
  p('por-bruno', 'Bruno Fernandes', 8, 'MID', 74, 85, 89, 62, 74),
  p('por-samu-costa', 'Samu Costa', 6, 'MID', 74, 58, 74, 78, 82),
  p('por-neto', 'Pedro Neto', 17, 'FWD', 90, 78, 78, 42, 68),
  p('por-felix', 'João Félix', 11, 'FWD', 82, 82, 82, 38, 64),
  p('por-ronaldo', 'Cristiano Ronaldo', 7, 'FWD', 74, 90, 76, 34, 76),
  p('por-conceicao', 'Conceição', 21, 'FWD', 89, 74, 74, 44, 62),

  // ── Spain ─────────────────────────────────────────────────────────────────
  p('esp-simon', 'Unai Simón', 23, 'GK', 56, 22, 78, 86, 82),
  p('esp-porro', 'Porro', 2, 'DEF', 83, 58, 82, 78, 76),
  p('esp-cubarsi', 'Cubarsí', 4, 'DEF', 78, 32, 84, 86, 76),
  p('esp-laporte', 'Laporte', 14, 'DEF', 72, 36, 78, 86, 84),
  p('esp-cucurella', 'Cucurella', 24, 'DEF', 82, 44, 78, 83, 78),
  p('esp-pubill', 'Pubill', 12, 'DEF', 80, 38, 70, 76, 78),
  p('esp-rodri', 'Rodri', 16, 'MID', 66, 78, 92, 85, 86),
  p('esp-pedri', 'Pedri', 8, 'MID', 78, 74, 91, 62, 64),
  p('esp-baena', 'Baena', 19, 'MID', 77, 74, 86, 58, 62),
  p('esp-fabian', 'Fabián Ruiz', 10, 'MID', 72, 76, 88, 70, 76),
  p('esp-zubimendi', 'Zubimendi', 6, 'MID', 70, 62, 85, 82, 78),
  p('esp-gavi', 'Gavi', 9, 'MID', 80, 70, 84, 70, 76),
  p('esp-yamal', 'Yamal', 18, 'FWD', 89, 87, 90, 38, 60),
  p('esp-olmo', 'Olmo', 20, 'FWD', 80, 84, 86, 50, 66),
  p('esp-oyarzabal', 'Oyarzabal', 21, 'FWD', 80, 85, 82, 46, 70),
  p('esp-nico', 'Nico Williams', 17, 'FWD', 94, 80, 76, 40, 70),
  p('esp-vmunoz', 'V. Muñoz', 26, 'FWD', 87, 72, 74, 40, 58),

  // ── United States ─────────────────────────────────────────────────────────
  p('usa-freese', 'Freese', 1, 'GK', 52, 20, 70, 80, 78),
  p('usa-brady', 'Brady', 18, 'GK', 48, 18, 62, 74, 74),
  p('usa-freeman', 'Freeman', 2, 'DEF', 84, 42, 72, 76, 76),
  p('usa-richards', 'Richards', 3, 'DEF', 80, 32, 70, 82, 84),
  p('usa-ream', 'Ream', 13, 'DEF', 62, 30, 76, 80, 76),
  p('usa-dest', 'Dest', 5, 'DEF', 86, 52, 78, 74, 68),
  p('usa-robinson', 'Robinson', 4, 'DEF', 88, 42, 72, 80, 80),
  p('usa-mckennie', 'McKennie', 8, 'MID', 76, 68, 76, 74, 84),
  p('usa-adams', 'Adams', 6, 'MID', 76, 55, 76, 82, 82),
  p('usa-tillman', 'Tillman', 10, 'MID', 78, 74, 80, 58, 68),
  p('usa-pulisic', 'Pulisic', 11, 'FWD', 88, 82, 80, 44, 66),
  p('usa-balogun', 'Balogun', 9, 'FWD', 86, 80, 68, 38, 78),
  p('usa-berhalter', 'Berhalter', 15, 'MID', 72, 60, 76, 70, 72),
  p('usa-arfsten', 'Arfsten', 16, 'DEF', 80, 44, 70, 72, 72),
  p('usa-zendejas', 'Zendejas', 7, 'FWD', 82, 72, 76, 42, 60),

  // ── Belgium ───────────────────────────────────────────────────────────────
  p('bel-courtois', 'Courtois', 1, 'GK', 55, 22, 76, 90, 86),
  p('bel-penders', 'Penders', 13, 'GK', 50, 18, 64, 76, 76),
  p('bel-castagne', 'Castagne', 21, 'DEF', 82, 46, 74, 79, 78),
  p('bel-ngoy', 'Ngoy', 4, 'DEF', 77, 30, 66, 78, 84),
  p('bel-mechele', 'Mechele', 3, 'DEF', 72, 32, 72, 79, 76),
  p('bel-decuyper', 'De Cuyper', 5, 'DEF', 81, 50, 78, 77, 76),
  p('bel-dewinter', 'De Winter', 2, 'DEF', 78, 32, 70, 79, 80),
  p('bel-debast', 'Debast', 17, 'DEF', 74, 34, 76, 78, 74),
  p('bel-seys', 'Seys', 22, 'DEF', 88, 46, 72, 74, 72),
  p('bel-onana', 'Onana', 8, 'MID', 78, 64, 78, 80, 88),
  p('bel-tielemans', 'Tielemans', 16, 'MID', 70, 76, 86, 70, 74),
  p('bel-raskin', 'Raskin', 6, 'MID', 74, 60, 78, 76, 76),
  p('bel-witsel', 'Witsel', 15, 'MID', 62, 58, 78, 76, 78),
  p('bel-vanaken', 'Vanaken', 20, 'MID', 66, 72, 84, 64, 78),
  p('bel-debruyne', 'De Bruyne', 7, 'MID', 70, 87, 94, 56, 74),
  p('bel-trossard', 'Trossard', 9, 'FWD', 84, 82, 80, 46, 64),
  p('bel-lukebakio', 'Lukebakio', 14, 'FWD', 88, 78, 74, 40, 70),
  p('bel-dekete', 'De Ketelaere', 23, 'FWD', 80, 82, 82, 48, 76),
  p('bel-doku', 'Doku', 11, 'FWD', 94, 74, 78, 42, 68),
  p('bel-moreira', 'Moreira', 19, 'FWD', 86, 70, 72, 40, 60),
  p('bel-fpardo', 'Fernández-Pardo', 25, 'FWD', 85, 72, 68, 38, 66),

  // ── Argentina ─────────────────────────────────────────────────────────────
  p('arg-emartinez', 'E. Martínez', 23, 'GK', 54, 22, 74, 88, 84),
  p('arg-molina', 'Molina', 26, 'DEF', 82, 46, 74, 78, 74),
  p('arg-romero', 'Romero', 13, 'DEF', 78, 36, 74, 87, 84),
  p('arg-lmartinez', 'L. Martínez', 25, 'DEF', 76, 32, 74, 85, 82),
  p('arg-tagliafico', 'Tagliafico', 3, 'DEF', 78, 42, 74, 81, 76),
  p('arg-paredes', 'Paredes', 5, 'MID', 66, 72, 85, 76, 78),
  p('arg-depaul', 'De Paul', 7, 'MID', 78, 70, 85, 74, 80),
  p('arg-enzo', 'Enzo Fernández', 24, 'MID', 74, 74, 88, 78, 80),
  p('arg-macallister', 'Mac Allister', 20, 'MID', 76, 78, 87, 72, 76),
  p('arg-messi', 'Messi', 10, 'FWD', 72, 92, 95, 32, 62),
  p('arg-alvarez', 'Julián Álvarez', 9, 'FWD', 86, 89, 80, 48, 76),
  p('arg-barco', 'Barco', 21, 'DEF', 82, 48, 76, 74, 70),
  p('arg-simeone', 'Simeone', 11, 'FWD', 88, 76, 70, 46, 74),
  p('arg-nicopaz', 'Nico Paz', 14, 'MID', 80, 78, 86, 50, 64),
  p('arg-jmlopez', 'J.M. López', 22, 'FWD', 80, 80, 78, 42, 74),
  p('arg-almada', 'Almada', 16, 'MID', 84, 76, 84, 48, 58),

  // ── Egypt ─────────────────────────────────────────────────────────────────
  p('egy-shoubir', 'Shoubir', 1, 'GK', 50, 18, 62, 78, 76),
  p('egy-alaa', 'Alaa', 16, 'GK', 46, 16, 58, 72, 72),
  p('egy-hany', 'Hany', 2, 'DEF', 78, 38, 70, 77, 76),
  p('egy-rabia', 'Rabia', 3, 'DEF', 72, 30, 64, 78, 80),
  p('egy-ibrahim', 'Ibrahim', 5, 'DEF', 70, 28, 62, 77, 82),
  p('egy-hafez', 'Hafez', 4, 'DEF', 76, 34, 66, 76, 78),
  p('egy-attia', 'Marawan Attia', 6, 'MID', 68, 50, 70, 78, 82),
  p('egy-lashin', 'Lashin', 8, 'MID', 72, 62, 76, 66, 70),
  p('egy-ashour', 'Ashour', 10, 'MID', 76, 68, 80, 62, 68),
  p('egy-zico', 'Mostafa Zico', 17, 'MID', 80, 66, 74, 56, 64),
  p('egy-hassan', 'Haissem Hassan', 11, 'FWD', 85, 70, 68, 40, 66),
  p('egy-salah', 'Salah', 7, 'FWD', 88, 90, 82, 44, 76),
  p('egy-abdelmaguid', 'Abdelmaguid', 12, 'DEF', 74, 32, 64, 74, 76),
  p('egy-tarekalaa', 'Tarek Alaa', 14, 'MID', 72, 56, 70, 64, 68),
  p('egy-saber', 'Saber', 9, 'FWD', 78, 68, 62, 38, 72),

  // ── Switzerland ───────────────────────────────────────────────────────────
  p('sui-kobel', 'Kobel', 1, 'GK', 55, 20, 72, 87, 82),
  p('sui-keller', 'Keller', 21, 'GK', 48, 18, 60, 74, 74),
  p('sui-elvedi', 'Elvedi', 4, 'DEF', 78, 32, 72, 82, 78),
  p('sui-akanji', 'Akanji', 5, 'DEF', 84, 38, 78, 86, 82),
  p('sui-rodriguez', 'Rodríguez', 13, 'DEF', 72, 40, 76, 80, 76),
  p('sui-amenda', 'Amenda', 18, 'DEF', 76, 30, 70, 78, 80),
  p('sui-comert', 'Cömert', 3, 'DEF', 72, 28, 66, 76, 78),
  p('sui-zakaria', 'Zakaria', 8, 'MID', 80, 62, 74, 80, 86),
  p('sui-jashari', 'Jashari', 16, 'MID', 74, 64, 82, 76, 76),
  p('sui-xhaka', 'Xhaka', 10, 'MID', 62, 70, 88, 76, 78),
  p('sui-freuler', 'Freuler', 6, 'MID', 72, 62, 80, 78, 78),
  p('sui-rieder', 'Rieder', 15, 'MID', 76, 74, 84, 58, 64),
  p('sui-sow', 'Sow', 14, 'MID', 76, 68, 78, 68, 74),
  p('sui-ndoye', 'Ndoye', 22, 'FWD', 89, 76, 72, 44, 76),
  p('sui-embolo', 'Embolo', 7, 'FWD', 84, 79, 72, 40, 86),
  p('sui-amdouni', 'Amdouni', 9, 'FWD', 82, 76, 74, 40, 68),

  // ── Colombia ──────────────────────────────────────────────────────────────
  p('col-vargas', 'Vargas', 1, 'GK', 52, 20, 68, 83, 78),
  p('col-munoz', 'Muñoz', 17, 'DEF', 85, 55, 74, 79, 80),
  p('col-dsanchez', 'D. Sánchez', 23, 'DEF', 76, 30, 70, 83, 84),
  p('col-lucumi', 'Lucumí', 3, 'DEF', 82, 28, 70, 82, 80),
  p('col-mojica', 'Mojica', 7, 'DEF', 84, 42, 72, 76, 74),
  p('col-puerta', 'Puerta', 15, 'DEF', 80, 40, 70, 74, 70),
  p('col-lerma', 'Lerma', 16, 'MID', 74, 64, 74, 80, 86),
  p('col-arias', 'Arias', 8, 'MID', 76, 62, 76, 70, 72),
  p('col-james', 'James Rodríguez', 10, 'MID', 68, 84, 90, 42, 64),
  p('col-suarez', 'Luis Suárez', 9, 'FWD', 84, 80, 70, 38, 78),
  p('col-diaz', 'Luis Díaz', 11, 'FWD', 91, 84, 78, 44, 72),
  p('col-castano', 'Castaño', 6, 'MID', 74, 60, 80, 72, 72),
  p('col-portilla', 'Portilla', 14, 'MID', 72, 58, 74, 74, 76),
  p('col-rios', 'Ríos', 5, 'MID', 76, 66, 80, 74, 78),
  p('col-ditta', 'Ditta', 2, 'DEF', 74, 28, 66, 78, 80),

  // ── Squad depth: players from the verified 26-man squads who did not feature
  // in the knockout matches above. Sources per squad in data/squads.ts. ──────

  // England
  p('eng-dhenderson', 'D. Henderson', 12, 'GK', 52, 20, 70, 83, 79),
  p('eng-jhenderson', 'J. Henderson', 18, 'MID', 62, 60, 80, 74, 74),
  p('eng-burn', 'Burn', 21, 'DEF', 58, 30, 62, 84, 90),
  p('eng-rjames', 'Reece James', 24, 'DEF', 84, 62, 84, 82, 80),
  p('eng-spence', 'Spence', 25, 'DEF', 86, 50, 74, 76, 74),
  p('eng-chalobah', 'Chalobah', 22, 'DEF', 76, 34, 72, 83, 82),
  p('eng-watkins', 'Watkins', 26, 'FWD', 85, 84, 74, 42, 78),
  p('eng-toney', 'Toney', 23, 'FWD', 74, 86, 72, 44, 84),

  // Mexico
  p('mex-acevedo', 'Acevedo', 12, 'GK', 50, 20, 62, 79, 75),
  p('mex-ochoa', 'Ochoa', 1, 'GK', 45, 18, 60, 78, 70),
  p('mex-ealvarez', 'E. Álvarez', 4, 'DEF', 72, 55, 78, 84, 86),
  p('mex-mateo-chavez', 'Mateo Chávez', 21, 'DEF', 80, 42, 72, 74, 70),
  p('mex-fidalgo', 'Fidalgo', 8, 'MID', 70, 64, 84, 68, 68),
  p('mex-pineda', 'Pineda', 10, 'MID', 78, 70, 80, 58, 62),
  p('mex-vega', 'Vega', 17, 'FWD', 84, 76, 74, 46, 68),
  p('mex-gimenez', 'S. Giménez', 19, 'FWD', 80, 83, 70, 40, 78),
  p('mex-agonzalez', 'A. González', 20, 'FWD', 82, 74, 62, 36, 72),
  p('mex-huerta', 'Huerta', 22, 'FWD', 88, 72, 70, 40, 60),
  p('mex-gmartinez', 'G. Martínez', 25, 'FWD', 74, 76, 64, 38, 80),

  // France
  p('fra-konate', 'Konaté', 24, 'DEF', 82, 30, 72, 87, 88),
  p('fra-lhernandez', 'L. Hernandez', 2, 'DEF', 78, 38, 72, 84, 84),
  p('fra-thernandez', 'T. Hernandez', 25, 'DEF', 90, 60, 78, 78, 80),
  p('fra-lacroix', 'Lacroix', 6, 'DEF', 84, 32, 68, 82, 84),
  p('fra-kante', 'Kanté', 12, 'MID', 74, 58, 80, 84, 80),
  p('fra-cherki', 'Cherki', 9, 'MID', 82, 80, 88, 36, 58),
  p('fra-mateta', 'Mateta', 15, 'FWD', 78, 83, 62, 38, 88),
  p('fra-thuram', 'Thuram', 19, 'FWD', 87, 84, 74, 42, 86),

  // Paraguay
  p('par-olveira', 'Olveira', 23, 'GK', 50, 18, 58, 76, 74),
  p('par-balbuena', 'Balbuena', 13, 'DEF', 62, 32, 64, 80, 84),
  p('par-canale', 'Canale', 14, 'DEF', 72, 30, 64, 77, 79),
  p('par-maidana', 'Maidana', 21, 'DEF', 74, 28, 60, 75, 78),
  p('par-mauricio', 'Maurício', 17, 'MID', 74, 60, 76, 64, 68),
  p('par-ojeda', 'Ojeda', 25, 'MID', 73, 56, 74, 70, 72),
  p('par-romero', 'Romero Gamarra', 7, 'MID', 76, 68, 82, 48, 60),
  p('par-sanabria', 'Sanabria', 19, 'FWD', 76, 80, 72, 40, 74),
  p('par-avalos', 'Ávalos', 24, 'FWD', 70, 76, 62, 42, 86),
  p('par-caballero', 'Caballero', 26, 'FWD', 84, 68, 62, 38, 66),
  p('par-pitta', 'Pitta', 22, 'FWD', 78, 74, 60, 36, 78),

  // Canada
  p('can-stclair', 'St. Clair', 18, 'GK', 54, 20, 68, 81, 80),
  p('can-jones', 'A. Jones', 15, 'DEF', 70, 32, 66, 77, 80),
  p('can-waterman', 'Waterman', 3, 'DEF', 68, 30, 64, 76, 78),
  p('can-cornelius', 'Cornelius', 6, 'DEF', 74, 32, 68, 79, 82),
  p('can-davies', 'Davies', 14, 'DEF', 94, 74, 80, 78, 80),
  p('can-choiniere', 'Choinière', 8, 'MID', 74, 64, 78, 68, 70),
  p('can-ikone', 'I. Koné', 24, 'MID', 78, 66, 80, 66, 76),
  p('can-nsaliba', 'N. Saliba', 26, 'MID', 72, 58, 76, 72, 74),
  p('can-flores', 'Flores', 25, 'MID', 78, 68, 80, 48, 58),
  p('can-shaffelburg', 'Shaffelburg', 23, 'FWD', 90, 70, 66, 42, 64),
  p('can-larin', 'Larin', 12, 'FWD', 70, 78, 64, 38, 82),

  // Morocco
  p('mar-tagnaouti', 'Tagnaouti', 26, 'GK', 48, 18, 58, 74, 74),
  p('mar-aguerd', 'Aguerd', 4, 'DEF', 76, 32, 70, 84, 82),
  p('mar-elouahdi', 'El Ouahdi', 21, 'DEF', 84, 50, 72, 76, 74),
  p('mar-riad', 'Riad', 24, 'DEF', 78, 30, 68, 80, 78),
  p('mar-belammari', 'Belammari', 25, 'DEF', 76, 34, 66, 74, 74),
  p('mar-amrabat', 'Amrabat', 13, 'MID', 72, 52, 76, 82, 86),
  p('mar-elkaabi', 'El Kaabi', 9, 'FWD', 74, 84, 64, 40, 82),
  p('mar-ezzalzouli', 'Ezzalzouli', 23, 'FWD', 89, 74, 72, 38, 62),
  p('mar-amaimouni', 'Amaimouni', 27, 'FWD', 82, 72, 66, 38, 72),

  // Brazil
  p('bra-weverton', 'Weverton', 12, 'GK', 48, 18, 60, 80, 76),
  p('bra-ederson', 'Ederson', 23, 'GK', 56, 22, 82, 84, 80),
  p('bra-wesley', 'Wesley', 13, 'DEF', 86, 44, 70, 76, 76),
  p('bra-alexsandro', 'Alex Sandro', 3, 'DEF', 70, 40, 72, 78, 76),
  p('bra-bremer', 'Bremer', 24, 'DEF', 80, 30, 66, 87, 86),
  p('bra-leopereira', 'Léo Pereira', 15, 'DEF', 74, 32, 68, 80, 80),
  p('bra-ibanez', 'Ibañez', 22, 'DEF', 76, 34, 70, 80, 80),
  p('bra-fabinho', 'Fabinho', 17, 'MID', 66, 58, 76, 80, 80),
  p('bra-paqueta', 'Paquetá', 10, 'MID', 78, 78, 86, 62, 76),
  p('bra-neymar', 'Neymar', 18, 'FWD', 78, 86, 90, 32, 58),
  p('bra-raphinha', 'Raphinha', 25, 'FWD', 87, 86, 82, 46, 68),

  // Norway
  p('nor-selvik', 'Selvik', 25, 'GK', 50, 18, 58, 74, 76),
  p('nor-ostigard', 'Østigård', 14, 'DEF', 74, 36, 66, 80, 84),
  p('nor-bjorkan', 'Bjørkan', 18, 'DEF', 80, 42, 72, 74, 72),
  p('nor-pedersen', 'H. Pedersen', 24, 'DEF', 83, 40, 70, 75, 74),
  p('nor-thorsby', 'Thorsby', 7, 'MID', 72, 54, 70, 76, 84),
  p('nor-aursnes', 'Aursnes', 17, 'MID', 76, 58, 80, 74, 72),
  p('nor-thorstvedt', 'Thorstvedt', 21, 'MID', 76, 70, 76, 64, 78),
  p('nor-aasgaard', 'Aasgaard', 26, 'MID', 74, 72, 78, 54, 70),
  p('nor-larsen', 'Strand Larsen', 19, 'FWD', 80, 82, 66, 38, 84),
  p('nor-hauge', 'Hauge', 22, 'FWD', 85, 74, 72, 40, 60),

  // Portugal
  p('por-ruisilva', 'Rui Silva', 22, 'GK', 52, 20, 68, 80, 76),
  p('por-semedo', 'Semedo', 2, 'DEF', 86, 42, 72, 77, 74),
  p('por-araujo', 'Tomás Araújo', 14, 'DEF', 78, 32, 70, 81, 80),
  p('por-dalot', 'Dalot', 26, 'DEF', 84, 52, 78, 78, 76),
  p('por-nunes', 'Matheus Nunes', 16, 'MID', 88, 66, 80, 68, 80),
  p('por-bernardo', 'Bernardo Silva', 10, 'MID', 78, 78, 90, 64, 64),
  p('por-rneves', 'Rúben Neves', 13, 'MID', 66, 72, 86, 76, 74),
  p('por-ramos', 'Gonçalo Ramos', 9, 'FWD', 80, 84, 70, 38, 80),
  p('por-trincao', 'Trincão', 15, 'FWD', 84, 76, 78, 40, 62),
  p('por-leao', 'Leão', 25, 'FWD', 92, 82, 76, 36, 78),
  p('por-guedes', 'Guedes', 5, 'FWD', 84, 76, 72, 38, 70),

  // Spain
  p('esp-raya', 'Raya', 1, 'GK', 56, 22, 80, 85, 78),
  p('esp-jgarcia', 'Joan García', 13, 'GK', 55, 20, 74, 84, 78),
  p('esp-grimaldo', 'Grimaldo', 3, 'DEF', 82, 68, 84, 76, 70),
  p('esp-egarcia', 'Eric García', 5, 'DEF', 72, 34, 80, 81, 74),
  p('esp-llorente', 'Llorente', 7, 'MID', 88, 72, 80, 72, 80),
  p('esp-merino', 'Merino', 15, 'MID', 70, 74, 82, 76, 82),
  p('esp-pino', 'Pino', 11, 'FWD', 86, 74, 76, 38, 58),
  p('esp-ferran', 'Ferran Torres', 22, 'FWD', 84, 82, 76, 44, 68),
  p('esp-iglesias', 'Borja Iglesias', 25, 'FWD', 68, 78, 64, 36, 80),

  // United States
  p('usa-turner', 'Turner', 25, 'GK', 50, 18, 58, 82, 78),
  p('usa-mckenzie', 'McKenzie', 12, 'DEF', 76, 30, 70, 79, 80),
  p('usa-mrobinson', 'M. Robinson', 14, 'DEF', 82, 32, 64, 81, 84),
  p('usa-trusty', 'Trusty', 24, 'DEF', 76, 32, 66, 78, 82),
  p('usa-scally', 'Scally', 20, 'DEF', 80, 38, 70, 76, 74),
  p('usa-roldan', 'Roldan', 17, 'MID', 74, 60, 74, 70, 74),
  p('usa-reyna', 'Reyna', 21, 'MID', 76, 76, 84, 50, 62),
  p('usa-pepi', 'Pepi', 19, 'FWD', 82, 80, 62, 36, 76),
  p('usa-weah', 'Weah', 22, 'FWD', 90, 74, 72, 50, 70),
  p('usa-wright', 'Wright', 23, 'FWD', 84, 78, 62, 36, 80),
  p('usa-aaronson', 'Aaronson', 26, 'FWD', 84, 70, 74, 52, 64),

  // Belgium
  p('bel-lammens', 'Lammens', 12, 'GK', 52, 18, 64, 80, 80),
  p('bel-theate', 'Theate', 24, 'DEF', 78, 36, 70, 81, 80),
  p('bel-meunier', 'Meunier', 18, 'DEF', 74, 52, 74, 76, 78),
  p('bel-lukaku', 'Lukaku', 10, 'FWD', 78, 87, 72, 38, 90),
  p('bel-saelemaekers', 'Saelemaekers', 26, 'FWD', 84, 72, 78, 58, 70),

  // Argentina
  p('arg-musso', 'Musso', 12, 'GK', 50, 18, 62, 82, 80),
  p('arg-rulli', 'Rulli', 1, 'GK', 52, 20, 68, 83, 80),
  p('arg-balerdi', 'Balerdi', 2, 'DEF', 78, 34, 70, 82, 82),
  p('arg-montiel', 'Montiel', 4, 'DEF', 80, 46, 74, 78, 74),
  p('arg-otamendi', 'Otamendi', 19, 'DEF', 62, 36, 70, 82, 84),
  p('arg-medina', 'Medina', 8, 'DEF', 78, 38, 72, 80, 80),
  p('arg-locelso', 'Lo Celso', 18, 'MID', 74, 74, 86, 58, 66),
  p('arg-palacios', 'Palacios', 6, 'MID', 76, 70, 84, 74, 74),
  p('arg-ngonzalez', 'N. González', 15, 'FWD', 84, 78, 74, 52, 74),
  p('arg-lautaro', 'Lautaro Martínez', 17, 'FWD', 85, 88, 74, 44, 80),

  // Egypt
  p('egy-elshenawy', 'El Shenawy', 23, 'GK', 46, 16, 60, 80, 74),
  p('egy-soliman', 'Soliman', 13, 'GK', 48, 16, 56, 74, 72),
  p('egy-fatouh', 'Fatouh', 21, 'DEF', 78, 40, 70, 74, 72),
  p('egy-abdelmonem', 'Abdelmonem', 24, 'DEF', 74, 32, 68, 82, 80),
  p('egy-fathy', 'Fathy', 15, 'MID', 70, 48, 68, 78, 80),
  p('egy-donga', 'Donga', 25, 'MID', 70, 50, 66, 76, 80),
  p('egy-zizo', 'Zizo', 22, 'FWD', 80, 76, 80, 48, 66),
  p('egy-marmoush', 'Marmoush', 18, 'FWD', 88, 86, 80, 42, 72),
  p('egy-trezeguet', 'Trezeguet', 19, 'FWD', 82, 74, 72, 44, 70),
  p('egy-adel', 'Ibrahim Adel', 26, 'FWD', 84, 74, 72, 40, 64),
  p('egy-abdelkarim', 'Abdelkarim', 20, 'FWD', 82, 68, 66, 36, 62),

  // Switzerland
  p('sui-mvogo', 'Mvogo', 12, 'GK', 52, 18, 60, 78, 78),
  p('sui-muheim', 'Muheim', 2, 'DEF', 78, 42, 74, 76, 74),
  p('sui-widmer', 'Widmer', 23, 'DEF', 80, 46, 72, 76, 74),
  p('sui-jaquez', 'Jaquez', 24, 'DEF', 76, 30, 66, 77, 80),
  p('sui-manzambi', 'Manzambi', 17, 'MID', 82, 68, 76, 62, 72),
  p('sui-aebischer', 'Aebischer', 20, 'MID', 74, 62, 80, 70, 72),
  p('sui-rvargas', 'R. Vargas', 11, 'FWD', 85, 74, 74, 42, 64),
  p('sui-fassnacht', 'Fassnacht', 19, 'FWD', 78, 72, 68, 52, 74),
  p('sui-okafor', 'Okafor', 25, 'FWD', 88, 76, 68, 36, 72),
  p('sui-itten', 'Itten', 26, 'FWD', 72, 76, 62, 38, 84),

  // Colombia
  p('col-ospina', 'Ospina', 25, 'GK', 48, 18, 64, 80, 72),
  p('col-montero', 'Montero', 22, 'GK', 50, 18, 60, 78, 78),
  p('col-sarias', 'S. Arias', 4, 'DEF', 76, 44, 72, 76, 72),
  p('col-mina', 'Mina', 13, 'DEF', 66, 40, 62, 80, 88),
  p('col-machado', 'Machado', 24, 'DEF', 82, 40, 70, 74, 72),
  p('col-carrascal', 'Carrascal', 19, 'MID', 80, 72, 80, 46, 64),
  p('col-quintero', 'Quintero', 20, 'MID', 66, 76, 88, 38, 58),
  p('col-campaz', 'Campaz', 21, 'MID', 82, 70, 74, 44, 62),
  p('col-cordoba', 'Córdoba', 18, 'FWD', 78, 80, 64, 40, 88),
  p('col-cgomez', 'C. Gómez', 26, 'FWD', 87, 72, 68, 40, 66),
  p('col-cucho', 'Cucho Hernández', 12, 'FWD', 82, 80, 72, 44, 74),
]

export const PLAYERS: Record<string, Player> = Object.fromEntries(ALL.map((player) => [player.id, player]))

/**
 * Real EA SPORTS FC 26 attributes (matched offline by the pipeline; see
 * pipeline/reports/player_matching.md) override the editorial estimates.
 * Natural positions stay OURS — they encode where each player really lined up.
 */
interface Fc26Entry {
  pace: number
  shooting: number
  passing: number
  defending: number
  physical: number
  fc26Name: string
  overall: number
  confidence: string
}
const FC26_RATINGS = fc26.players as Record<string, Fc26Entry>

for (const [id, r] of Object.entries(FC26_RATINGS)) {
  const player = PLAYERS[id]
  if (!player) continue
  player.ratings = {
    ...player.ratings,
    pace: r.pace,
    shooting: r.shooting,
    passing: r.passing,
    defending: r.defending,
    physical: r.physical,
  }
}

export type RatingSource = 'fc26' | 'estimate'

export function ratingSource(id: string): RatingSource {
  return FC26_RATINGS[id] ? 'fc26' : 'estimate'
}

export function fc26Info(id: string): Fc26Entry | null {
  return FC26_RATINGS[id] ?? null
}

export const PLAYER_RATINGS_META = fc26.meta

export function getPlayer(id: string): Player {
  const player = PLAYERS[id]
  if (!player) throw new Error(`Unknown player id: ${id}`)
  return player
}
