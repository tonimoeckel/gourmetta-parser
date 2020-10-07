import { parse } from 'node-html-parser';
import NodeType from "node-html-parser/dist/nodes/type";
import nodeFetch from 'node-fetch';
import fetchCookie from "fetch-cookie";
import FormData from "form-data";
import XLSX from "xlsx";

const fetch = fetchCookie(nodeFetch)

export interface Menu {
    title: string,
    prices: number[]
}

export interface MenuWeek {
    menu: Menu[],
    date: string,
    title: string
}

interface Credentials {
    username: string
    password: string
}

interface DateOption {
    text: string,
    value: string
}

export default class GourmettaParser {

    credentials: Credentials

    constructor(credentials: Credentials) {
        this.credentials = credentials;
    }

    public login() {

        const form = new FormData();
        form.append('Login_Name', this.credentials.username);
        form.append('Login_Passwort', this.credentials.password);

        return fetch("https://bestellung.gourmetta.de/index.php?m=2;0&ear_a=akt_login",{
            method: 'POST',
            body: form
        })
    }

    public logout() {
        return fetch('https://bestellung.gourmetta.de/index.php?m=2;0&ear_a=akt_login&a=login/logout')
    }

    public fetch(): Promise<MenuWeek[]> {

        return this.login().then((body: any) => {

            if (!body) return null;

            return body.text().then((t: string) => {

                return this.parseSelection(t).then((options: DateOption[]) => {

                    const funcs = options.map((option: DateOption) => {
                        return () => {

                            const form = new FormData();
                            form.append('sel_datum', option.value);

                            return fetch("https://bestellung.gourmetta.de/index.php?m=2;0",{
                                method: 'POST',
                                body: form
                            }).then((b: any) => {
                                return b.text().then((weekText: string) => {
                                    return {
                                        menu: this.parseWeek(weekText),
                                        date: option.value,
                                        title: option.text
                                    }
                                })
                            })
                        }
                    })
                    return Promise.all(funcs.map((item) => item())).then((res) => {
                        return res.sort(item => item.date).filter((item) => {
                            return item.date > (new Date().getTime() / 1000)
                        })
                    });
                })
            })

        }).then((res: any) => {
            return new Promise((resolve) => {
                this.logout().then(() => {
                    resolve(res);
                }).catch(() => {
                    resolve(res);
                })
            })
        })

    }

    public parseSelection(htmlString: string): Promise<DateOption[]> {

        const root = parse(htmlString);
        const options = root.querySelectorAll('.splanselect form select option');
        return Promise.resolve(options.map((option) => {
            return {
                value: option.getAttribute('value'),
                text: option.text,
            }
        }).filter((item) => !!item.value) as DateOption[])
    }

    public parseWeek(htmlString: string): Menu[] {

        const root = parse(htmlString);
        const trs = root.querySelectorAll('.splanauflistung tr');
        let res: any[] = [];
        if (trs){
            res = trs.filter((node) => {
                return node.nodeType === NodeType.ELEMENT_NODE && node.hasAttribute("name") && node.getAttribute("name") === "WarmSpeisen"
            }).map((dayNode) => {
                let prices: any[] = [];
                const priceNodes = dayNode.querySelectorAll('.preis');
                if (priceNodes) {
                    prices = priceNodes.map((price) => {
                        return price.text
                    })
                        .map((text) => {
                            return Number.parseFloat(text.replace(' €',''));
                        })
                }

                let title = dayNode.querySelector('.head img')?.getAttribute('alt') ||
                    dayNode.querySelector('.head .menue_bez')?.text;
                if (title){
                    title = title.replace(/\r/g,'');
                    title = title.replace(/\n/g,'');
                }

                return {
                    title,
                    prices
                }
            })
        }
        return res;
    }


    generateExcel(menuWeeks: MenuWeek[], filename?: string) {

        const newWb = XLSX.utils.book_new();

        menuWeeks.forEach((menuWeek) => {
            const cols = ['Menu','Montag','Dienstag','Mittwoch', 'Donnerstag','Freitag']

            if (menuWeek.menu && menuWeek.menu.length ){
                const pricesTable = menuWeek.menu.map((menu) => {
                    return cols.reduce((acc, key) => {
                        let value;
                        switch (key){
                            case 'Menu': {
                                value = menu.title;
                                break;
                            }
                            default: {
                                value = menu.prices[cols.indexOf(key)-1] || 0;
                                break;
                            }

                        }
                        acc[key] = value
                        return acc;
                    },{})
                });

                const newSheet = XLSX.utils.json_to_sheet(pricesTable);
                let title = menuWeek.title;
                if (title.length > 6){
                    title = title.substring(0,6);
                }
                title = title.replace(/|/g,'');
                title = title.replace(/:/g,'');

                XLSX.utils.book_append_sheet(newWb, newSheet, title);
            }
        })

        if (filename && newWb.SheetNames.length){
            XLSX.writeFile(newWb, filename);
        }

        return newWb;

    }

}

