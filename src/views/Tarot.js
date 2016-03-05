'use strict';

import React, {Component} from 'react'
import {w3cwebsocket} from 'websocket'
import uuid from 'uuid'

import Table from './Table'
import {Actions, ServerResponses} from '../datastructure'
import {Etats} from '../server/Jeu'

export default class Tarot extends Component {
    static defaultProps = {
    };
    state = {
        jeu: null,
        client: null,
        moi: null,
        joueurs: null,
        guid: null,
        nomJoueur: ""
    };
    componentWillMount() {
        const nomJoueur = localStorage.getItem("nomJoueur");
        if (nomJoueur) {
            this.setState({nomJoueur});
        }
    }
    componentDidMount() {
        const client = new w3cwebsocket((location.protocol == "http:" ? 'ws://' : "wss://")+ location.hostname + (location.port ? ':' + location.port : '') + '/tarot/ws/', 'tarot-protocol');

        client.onerror = () => {
            console.log('Connection Error');
        };

        client.onopen = () => {
            console.log('WebSocket Client Connected');
            if (client.readyState === client.OPEN) {
                let guid;
                if (localStorage.getItem("guid") !== null) {
                    guid = localStorage.getItem("guid");
                    client.send(JSON.stringify(Actions.makeRejoindre(guid)));
                } else {
                    guid = uuid.v4();
                }
                localStorage.setItem("guid", guid);

                this.setState({guid, client});
            }
        };

        client.onclose = () => {
            console.log('tarot-protocol Client Closed');
        };

        client.onmessage = (e) => {
            if (typeof e.data === 'string') {
                const m = JSON.parse(e.data);
                console.log(m);
                switch (m.type) {
                    case ServerResponses.JEU:
                        this.setState({jeu: m.jeu});
                        break;
                    case ServerResponses.JOUEUR_JOINT: {
                            const moi = m.joueurs.findIndex(nom => nom == this.state.nomJoueur);
                            if (moi == -1) {
                                this.setState({joueurs: null, moi: null});
                            } else {
                                this.setState({joueurs: m.joueurs, moi: moi});
                            }
                            break;
                    }
                    case ServerResponses.REJOINDU: {
                        const moi = m.moi != null ? m.moi : m.joueurs.findIndex(nom => nom == this.state.nomJoueur);
                        this.setState({joueurs: m.joueurs, moi: moi});
                        break;
                    }
                }
            }
        };
    }
    render() {
        if (this.state.jeu == null) {
            if (this.state.client == null || this.state.client.readyState !== this.state.client.OPEN) {
                return <span>Waiting for server...</span>
            } else if (this.state.joueurs == null) {
                return <div>
                    <input type="text" value={this.state.nomJoueur} placeholder="Nom" onChange={(e) => {this.setState({nomJoueur: e.target.value});localStorage.setItem("nomJoueur", e.target.value);}}/>
                    <input type="button" value="Joindre" onClick={() => this.state.client.send(JSON.stringify(Actions.makeJoindre(this.state.guid, this.state.nomJoueur)))}/>
                </div>;
            } else {
                return <div>
                    {this.state.joueurs.length} joueurs: {this.state.joueurs.join(", ")}<br/>
                    <input type="button" value="Commencer le jeu" onClick={() => this.state.client.send(JSON.stringify(Actions.makeStart()))}/>
                    <input type="button" value="Quitter" onClick={() => this.state.client.send(JSON.stringify(Actions.makeQuitter()))}/>
                </div>;
            }
        }

        return <div>
            <Table jeu={this.state.jeu}
                      moi={this.state.moi}
                      onPlayCard={(card) => this.state.client.send(JSON.stringify(Actions.makeCarteClick(card)))}
                      onCouper={(nombre) => this.state.client.send(JSON.stringify(Actions.makeCoupe(nombre)))}
                      onPrendsPasse={(prends) => this.state.client.send(JSON.stringify(Actions.makePrendsPasse(prends)))}
                      onFiniFaireJeu={() => this.state.client.send(JSON.stringify(Actions.makeFiniFaireJeu()))}
            />
            <input type="button" value="Fermer le jeu" onClick={() => this.state.client.send(JSON.stringify(Actions.makeQuitterJeu()))}/>
            {this.state.jeu.etat == Etats.FINI ? <input type="button" value="Prochain jeu" onClick={() => this.state.client.send(JSON.stringify(Actions.makeProchainJeu()))}/> : ""}
        </div>
    }
}
