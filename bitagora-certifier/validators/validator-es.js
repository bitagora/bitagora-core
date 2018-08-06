/**
 * BITAGORA CERTIFIER
 * validator-es.js
 * Example of validator file. This validator is used to validate Spanish ESP ID codes.
 * Validator files need to export a function:
 *      function validId(id) { ... }
 *  This function takes a single parameter (id) and returns true or false
 *
 * Repo: https://github.com/bitagora/bitagora-core
 *
 * ------------------------------------------------------------------------------
 */

function validId(id) {
	if (id.length != 90) return false;
	let idtype = id.substr(0,2);
	let idstate = id.substr(2,3);
	let nserie = id.substr(5,9);
	let control1 = id.substr(14,1);
	let idnum = id.substr(15,8);
	let idletter = id.substr(23,1);
	let pad1 = id.substr(24,6);
	let birthdate = id.substr(30,6);
	let control2 = id.substr(36,1);
	let sex = id.substr(37,1);
	let expdate = id.substr(38,6);
	let control3 = id.substr(44,1);
	let nationality = id.substr(45,3);
	let pad2 = id.substr(48,11);
	let control4 = id.substr(59,1);
	let lastline = id.substr(60,30).split("*")
	let surname1 = lastline[0]
	let surname2 = lastline[1]
	let firstname = lastline[3]
	if (lastline[4]) { firstname = firstname + "-" + lastline[4] } 
	let namelength = surname1.length + surname2.length + firstname.length + 3;
	if (30-namelength > 0) {
		pad3 = id.substr(60 + namelength, -1);
	} else { 
		pad3 = "";		
	}
	if (idtype != "ID") return false;
	if (idstate != "ESP") return false;  
	if ((sex != "M") && (sex != "F")) return false;
	if (nationality != "ESP") return false; 
	let letters_dni = "TRWAGMYFPDXBNJZSQVHLCKE";
	let resto = parseInt(idnum) % 23;
	let letter = letters_dni.substr(resto,1);
	if (idletter != letter) return false; 
	if (checkControl(control1, nserie) == 0) return false;
	if (checkControl(control2, birthdate) == 0) return false;
	if (checkControl(control3, expdate) == 0)  return false;
	let concat = nserie + control1 + idnum + idletter +  birthdate + control2 + expdate + control3;
	if (checkControl(control4, concat) == 0) return false;
	let eyear = "20"+expdate.substr(0,2)
	let emonth = (parseInt(expdate.substr(2,2)) - 1).toString();
	let eday = expdate.substr(4,2);
	let expiration = Date(eyear, emonth, eday);
	if (expiration<today) return false;
	var byear;
	if (parseInt(expdate.substr(0,2)) <= parseInt(today.getFullYear().toString().substr(2,2))) {
		byear = "20"+birthdate.substr(0,2);
	} else {
		byear = "19"+birthdate.substr(0,2);
	}
	let bmonth = (parseInt(birthdate.substr(2,2)) - 1).toString();
	let bday = birthdate.substr(4,2);
	var birthday = Date(byear, bmonth, bday);
	let eighteen = new Date();
    eighteen.setFullYear(eighteen.getFullYear() - 18);
  	if (birthday > eighteen) return false;
	if (birthday > today) return false;
	return true;
}

function checkControl(control, string) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let array = [];
	var index;
	for (var i=0; i<string.length;i++) {
		index = alphabet.indexOf(string[i]);
		if (index !== -1) {
			array[i] = index + 10;
		} else {
			array[i] = parseInt(string[i]);
		}
	}
	let number = 0;
	let count = 7;
	for (var j=0; j<array.length; j++) {
	 	number = number + (array[j] * count);
		if (count == 7) {
			count = 3;
		} else if (count == 3) {
			count = 1;
		} else {
			count = 7;
		}
	}
	return parseInt(control) === (number % 10);
}

module.exports = {
	validId
}