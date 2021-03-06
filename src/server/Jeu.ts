import {connection} from 'websocket';
import {TarotCartes} from '../datastructure/cartes';
import {Card} from '../enums/Card';
import {CardColor} from '../enums/CardColor';
import {IData} from '../interfaces/IData';

export enum Etats {
    PAS_DE_JEU = 'pasDeJeu',
    COUPER = 'Couper',
    DISTRIBUER = 'Distribuer',
    APPELER_ROI = 'AppelerRoi',
    CHIEN_MONTREE = 'chienMontree',
    FAIRE_JEU = 'faireJeu',
    QUI_PREND = 'QuiPrend',
    MONTRE_CARTES = 'montreCartes',
    JEU = 'Jeu',
    FINI = 'Fini',
}

export default class Jeu {
    public static couleurs: { [couleur: string]: number } = {P: 0, K: 1, T: 2, C: 3, A: 4};
    public static cartesType: { [type: string]: number } = {
        1: 0,
        2: 1,
        3: 2,
        4: 3,
        5: 4,
        6: 5,
        7: 6,
        8: 7,
        9: 8,
        10: 9,
        C: 11,
        D: 12,
        R: 13,
        V: 10,
    };

    public static creeNouveauJeu(nomJoueurs: string[]): Jeu {
        const cartes = [...TarotCartes];
        shuffle(cartes);
        const premierTourDe = Math.floor(Math.random() * nomJoueurs.length);
        const data: IData = {
            cartes,
            cartesJoueurs: [],
            chat: '',
            chien: [],
            coupDe: null,
            dernierPli: [],
            etat: Etats.FINI,
            excuseDe: null,
            excusePliFaitPar: null,
            joueurAvecRoi: null,
            joueurs: nomJoueurs.length,
            nomJoueurs,
            pli: [],
            pliFait: [],
            pointsNecessaire: null,
            premierTourDe,
            preneur: null,
            preneurAGagne: null,
            reponsePrisePasse: 0,
            resultat: null,
            roiAppele: null,
            tourDe: premierTourDe,
        };
        const jeu = new Jeu(data, []);
        jeu.prochainJeu();
        return jeu;
    }

    private static ordreCartes(a: Card, b: Card) {
        if (a === '--' && b === '--') {
            return 0;
        }
        if (a === '--' || a === 'J') {
            return -1;
        } else if (b === '--' || b === 'J') {
            return 1;
        }

        const couleurA = a.substring(0, 1);
        const couleurB = b.substring(0, 1);
        if (couleurA !== couleurB) {
            return Jeu.couleurs[couleurA] - Jeu.couleurs[couleurB];
        } else if (couleurA === 'A') {
            return parseInt(a.substring(1), 10) - parseInt(b.substring(1), 10);
        } else {
            return Jeu.cartesType[a.substring(1)] - Jeu.cartesType[b.substring(1)];
        }
    }

    private static cartePermis(carte: Card, pli: Card[], cartes: Card[]) {
        if (carte === 'J') {
            return true;
        }
        let couleurMettre: CardColor | null = null;
        let hautAtout: number | null = null;
        pli.forEach(c => {
            const couleur = c.substring(0, 1);
            if (couleur !== 'J') {
                if (couleurMettre == null) {
                    couleurMettre = couleur;
                }
                if (couleur === 'A') {
                    const atout = parseInt(c.substring(1), 10);
                    if (hautAtout === null || hautAtout < atout) {
                        hautAtout = atout;
                    }
                }
            }
        });

        if (couleurMettre == null) {
            return true;
        }

        const carteCouleur = carte.substring(0, 1);
        if (carteCouleur === couleurMettre) {
            if (couleurMettre === 'A' && hautAtout !== null) {
                const atout = parseInt(carte.substr(1), 10);
                if (atout < hautAtout) {
                    for (const c of cartes) {
                        if (c.substring(0, 1) === 'A' && parseInt(c.substr(1), 10) > hautAtout) {
                            return false;
                        }
                    }
                }
            }
            return true;
        }

        for (const c of cartes) {
            if (c.substr(0, 1) === couleurMettre) {
                return false;
            }
        }

        if (couleurMettre !== 'A' && hautAtout !== null) {
            for (const c of cartes) {
                if (c.substr(0, 1) === 'A') {
                    if (carteCouleur !== 'A') {
                        return false;
                    }
                    const catout = parseInt(c.substr(1), 10);
                    const carteAtout = parseInt(carte.substr(1), 10);
                    if (carteAtout > hautAtout) {
                        return true;
                    }
                    if (catout > carteAtout) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    private static quiGagnePli(pli: Card[]) {
        let pliPour = 0;
        let carteHaute: Card | null = null;
        pli.forEach((c, i) => {
            const couleur = c.substring(0, 1);
            if (couleur !== 'J') {
                if (carteHaute == null) {
                    carteHaute = c;
                    pliPour = i;
                } else {
                    if (carteHaute.substring(0, 1) === 'A') {
                        if (c.substring(0, 1) === 'A') {
                            const atout = parseInt(c.substring(1), 10);
                            const atoutHaute = parseInt(carteHaute.substring(1), 10);
                            if (atout > atoutHaute) {
                                carteHaute = c;
                                pliPour = i;
                            }
                        }
                    } else {
                        if (c.substring(0, 1) === 'A') {
                            carteHaute = c;
                            pliPour = i;
                        } else if (c.substring(0, 1) === carteHaute.substring(0, 1)) {
                            if (Jeu.cartesType[c.substring(1)] > Jeu.cartesType[carteHaute.substring(1)]) {
                                carteHaute = c;
                                pliPour = i;
                            }
                        }
                    }
                }
            }
        });
        return pliPour;
    }

    private static compteCartes(cartes: Card[]) {
        return cartes.reduce((count, c) => count + Jeu.pointsCarte(c), 0);
    }

    private static pointsCarte(carte: Card) {
        if (carte === 'J') {
            return 4.5;
        }
        const couleur = carte.substring(0, 1);
        const type = carte.substring(1);
        if (couleur === 'A') {
            if (type === '1' || type === '21') {
                return 4.5;
            }
            return .5;
        }
        switch (type) {
            case 'R':
                return 4.5;
            case 'D':
                return 3.5;
            case 'C':
                return 2.5;
            case 'V':
                return 1.5;
            default:
                return .5;
        }
    }

    private static pointsNecessaire(cartes: Card[]) {
        const points = [56, 51, 41, 31];
        const bouts = cartes.reduce((count, c) => {
            switch (c) {
                case 'A1':
                    return count + 1;
                case 'A21':
                    return count + 1;
                case 'J':
                    return count + 1;
                default:
                    return count;
            }
        }, 0);
        return points[bouts];
    }

    private static nombrePourChien(joueurs: number) {
        if (joueurs === 5) {
            return 3;
        } else {
            return 6;
        }
    }

    public connections: connection[] = [];

    public invalid = false;

    constructor(public data: IData, public guids: string[]) {
    }

    public prochainJeu() {
        if (this.data.etat !== Etats.FINI) {
            return;
        }
        this.data.etat = Etats.COUPER;
        this.data.premierTourDe = (this.data.premierTourDe + 1) % this.data.joueurs;
        this.data.tourDe = this.data.premierTourDe;
        this.data.coupDe = (this.data.tourDe + this.data.joueurs - 2) % this.data.joueurs;
        this.data.reponsePrisePasse = 0;

        this.data.cartes = this.data.cartes.concat(this.data.chien, ...this.data.cartesJoueurs, ...this.data.pliFait);
        this.data.chien = [];

        for (let i = 0; i < this.data.joueurs; i++) {
            this.data.cartesJoueurs[i] = [];
            this.data.pliFait[i] = [];
        }

        this.data.preneur = null;
        this.data.roiAppele = null;
        this.data.joueurAvecRoi = null;
        this.data.pli = [];
        this.data.dernierPli = [];
        this.data.excuseDe = null;
        this.data.excusePliFaitPar = null;
        this.data.resultat = null;
        this.data.pointsNecessaire = null;
        this.data.preneurAGagne = null;
    }

    public coupe(nombre: number) {
        this.data.cartes = this.data.cartes.slice(nombre).concat(this.data.cartes.slice(0, nombre));
        this.data.coupDe = null;

        this.data.etat = Etats.DISTRIBUER;
    }

    public jePrendsPasse(qui: number, prends: boolean, callback: () => void) {
        if (this.data.etat !== Etats.QUI_PREND || qui !== this.data.tourDe) {
            // TODO error
            return;
        }
        if (prends) {
            this.data.preneur = qui;
        }
        this.data.reponsePrisePasse += 1;
        if (this.data.reponsePrisePasse === this.data.joueurs) {
            if (this.data.preneur == null) {
                this.data.etat = Etats.FINI;
                this.prochainJeu();
                callback();
                return;
            } else {
                this.data.cartesJoueurs.forEach(cartes => cartes.sort(Jeu.ordreCartes));
                if (this.data.joueurs === 5) {
                    this.data.etat = Etats.APPELER_ROI;
                } else {
                    this.montreChien(callback);
                }
            }
        }
        this.data.tourDe = (this.data.tourDe + 1) % this.data.joueurs;
        callback();
    }

    public montreChien(callback: () => void) {
        this.data.etat = Etats.CHIEN_MONTREE;
        setTimeout(() => {
            if (this.data.preneur === null) {
                console.warn('MontreChien error: Preneur is not set');
                return;
            }
            this.data.cartesJoueurs[this.data.preneur] = this.data.cartesJoueurs[this.data.preneur].concat(
                this.data.chien);
            this.data.cartesJoueurs[this.data.preneur].sort(Jeu.ordreCartes);
            this.data.chien = [];
            this.data.etat = Etats.FAIRE_JEU;
            callback();
        }, 7000);
    }

    public carteClick(qui: number, carte: Card, callback: () => void) {
        if (this.data.etat === Etats.FAIRE_JEU) {
            this.faireJeu(qui, carte);
        } else if (this.data.etat === Etats.JEU) {
            this.joueCarte(qui, carte, callback);
        } else if (this.data.etat === Etats.APPELER_ROI && this.data.preneur === qui) {
            if (['PR', 'TR', 'CR', 'KR'].indexOf(carte) !== -1) {
                this.data.roiAppele = carte;
                this.montreChien(callback);
            }
        } else {
            // TODO error
        }
        callback();
    }

    public faireJeu(qui: number, carte: Card) {
        if (this.data.etat !== Etats.FAIRE_JEU || qui !== this.data.preneur) {
            // TODO error
            return;
        }
        if (carte.substring(0, 1) === 'A' || carte.substring(1) === 'R') {
            // TODO what does this check do?
            return;
        }
        const dansCarte = this.data.cartesJoueurs[qui].findIndex(c => c === carte);
        if (dansCarte !== -1) {
            this.data.cartesJoueurs[qui].splice(dansCarte, 1);
            this.data.pli.push(carte);
        } else {
            const dansEcart = this.data.pli.findIndex(c => c === carte);
            if (dansEcart !== -1) {
                this.data.pli.splice(dansEcart, 1);
                this.data.cartesJoueurs[qui].push(carte);
                this.data.cartesJoueurs[qui].sort(Jeu.ordreCartes);
            }
        }
    }

    public finiFaireJeu(qui: number) {
        if (this.data.etat !== Etats.FAIRE_JEU ||
            qui !== this.data.preneur ||
            this.data.pli.length !== Jeu.nombrePourChien(this.data.joueurs)) {
            // TODO error
            return;
        }
        this.data.pliFait[qui] = this.data.pli;
        this.data.pli = [];

        this.data.etat = Etats.JEU;
    }

    public joueCarte(qui: number, carte: Card, callback: () => void) {
        if (this.data.etat !== Etats.JEU || qui !== this.data.tourDe) {
            // TODO error
            return;
        }
        const carteIndex = this.data.cartesJoueurs[qui].findIndex(c => c === carte);
        if (carteIndex === -1) {
            // TODO error
            return;
        }

        if (!Jeu.cartePermis(carte, this.data.pli, this.data.cartesJoueurs[qui])) {
            // TODO error
            return;
        }

        if (carte === this.data.roiAppele) {
            this.data.joueurAvecRoi = qui;
        }

        this.data.cartesJoueurs[qui].splice(carteIndex, 1);
        this.data.pli.push(carte);
        this.data.tourDe = (this.data.tourDe + 1) % this.data.joueurs;

        if (this.data.pli.length === this.data.joueurs) {
            this.data.etat = Etats.MONTRE_CARTES;
            setTimeout(() => {
                this.data.dernierPli = this.data.pli.slice();
                this.data.etat = Etats.JEU;

                const pourQui = (this.data.tourDe + Jeu.quiGagnePli(this.data.pli)) % this.data.joueurs;
                const excuseIndex = this.data.pli.findIndex(c => c === 'J');
                if (excuseIndex !== -1) {
                    const excuseDe = (this.data.tourDe + excuseIndex) % this.data.joueurs;
                    const pourPreneur = pourQui === this.data.preneur || pourQui === this.data.joueurAvecRoi;
                    const exceuseDePreneur = excuseDe === this.data.preneur || excuseDe === this.data.joueurAvecRoi;
                    if (pourPreneur !== exceuseDePreneur) {
                        this.data.pliFait[excuseDe] = this.data.pliFait[excuseDe].concat(
                            this.data.pli.splice(excuseIndex, 1));
                        this.data.excuseDe = excuseDe;
                        this.data.excusePliFaitPar = pourQui;
                    }
                    this.essayDonnerCartePourExcuse();
                }

                this.data.pliFait[pourQui] = this.data.pliFait[pourQui].concat(this.data.pli);
                this.data.pli = [];
                this.data.tourDe = pourQui;

                this.essayDonnerCartePourExcuse();

                if (this.data.cartesJoueurs[0].length === 0 && this.data.preneur !== null) {
                    this.data.etat = Etats.FINI;
                    this.data.resultat = this.data.pliFait.map(pli => Jeu.compteCartes(pli));
                    const cartesPreneur = this.data.joueurAvecRoi === null ?
                        this.data.pliFait[this.data.preneur] :
                        this.data.pliFait[this.data.preneur].concat(this.data.pliFait[this.data.joueurAvecRoi]);
                    this.data.pointsNecessaire = Jeu.pointsNecessaire(cartesPreneur);
                    this.data.preneurAGagne = Jeu.compteCartes(cartesPreneur) > this.data.pointsNecessaire;
                }
                callback();
            }, 3000);
        }
    }

    public essayDonnerCartePourExcuse() {
        if (this.data.excuseDe === null || this.data.excusePliFaitPar === null) {
            return;
        }
        if (this.data.roiAppele !== null) {
            if (this.data.joueurAvecRoi == null) {
                return;
            }
            const pourPreneur = this.data.excusePliFaitPar === this.data.preneur || this.data.excusePliFaitPar ===
                this.data.joueurAvecRoi;
            const exceuseDePreneur = this.data.excuseDe === this.data.preneur || this.data.excuseDe ===
                this.data.joueurAvecRoi;
            if (pourPreneur === exceuseDePreneur) {
                this.data.excuseDe = null;
                this.data.excusePliFaitPar = null;
                return;
            }
        }
        const de = this.data.pliFait.filter(
            (cartes, i) => (this.data.excuseDe === this.data.preneur &&
                (i === this.data.preneur || i === this.data.joueurAvecRoi)) ||
                (this.data.excuseDe !== this.data.preneur && i !== this.data.preneur),
        );
        for (const cartes of de) {
            const index = cartes.findIndex(c => Jeu.pointsCarte(c) === .5);
            if (index !== -1) {
                this.data.pliFait[this.data.excusePliFaitPar] = this.data.pliFait[this.data.excusePliFaitPar].concat(
                    cartes.splice(index, 1));
                this.data.excuseDe = null;
                this.data.excusePliFaitPar = null;
                return;
            }
        }
    }

    public distribue(stepCallback: () => void) {
        const dos = (prochain: number) => {
            if (this.data.cartes.length <= 0) {
                this.data.etat = Etats.QUI_PREND;
                stepCallback();
                return;
            }
            this.data.cartesJoueurs[prochain] = this.data.cartesJoueurs[prochain].concat(this.data.cartes.slice(0, 3));
            this.data.cartes = this.data.cartes.slice(3);

            stepCallback();

            const cartesManquantChien = Jeu.nombrePourChien(this.data.joueurs) - this.data.chien.length;
            if (this.data.cartes.length - 3 - cartesManquantChien === 0) {// pas les trois dernières cartes
                this.data.chien = this.data.chien.concat(this.data.cartes.slice(0, cartesManquantChien));
                this.data.cartes = this.data.cartes.slice(cartesManquantChien);
                stepCallback();
            } else if (cartesManquantChien > 0 && Math.random() < .4) {
                this.data.chien = this.data.chien.concat(this.data.cartes[0]);
                this.data.cartes = this.data.cartes.slice(1);
                stepCallback();
            }
            setTimeout(() => dos((prochain + 1) % this.data.joueurs), 100);
        };
        dos(this.data.tourDe);
    }

    public anonymize(qui: number): IData {
        let chien = this.data.chien;
        if (this.data.etat !== Etats.CHIEN_MONTREE) {
            chien = chien.map(() => '--');
        }
        let pli = this.data.pli;
        if (this.data.etat === Etats.FAIRE_JEU && this.data.preneur !== qui) {
            pli = pli.map(() => '--');
        }
        const cartesJoueurs = this.data.cartesJoueurs.map((cartes, i) => {
            if (i === qui) {
                return cartes;
            } else {
                return cartes.map(() => '--');
            }
        });
        let pliFait = this.data.pliFait;
        if (this.data.dernierPli.length === 0) {
            pliFait = pliFait.map(
                (cartes, i) => this.data.preneur !== i || qui !== i ? cartes.map(() => '--') : cartes);
        } else {
            pliFait = pliFait.map(
                cartes => cartes.map(c => this.data.dernierPli.findIndex(pc => pc === c) === -1 ? '--' : c));
        }
        const cartesCachés = this.data.cartes.map(() => '--');
        return {...this.data, pli, cartes: cartesCachés, chien, cartesJoueurs, pliFait};
    }
}

function shuffle(a: Card[]) {
    for (let i = a.length; i; i -= 1) {
        const j = Math.floor(Math.random() * i);
        const x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}
