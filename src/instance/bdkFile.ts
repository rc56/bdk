import path from 'path'
import fs from 'fs-extra'
import YAML from 'yaml'
import { parse, stringify } from 'envfile'
import CryptoConfigYaml from '../model/yaml/network/cryptoConfigYaml'
import ConnectionConfigYaml from '../model/yaml/network/connectionConfigYaml'
import ConfigtxYaml, { ConfigtxOrgs } from '../model/yaml/network/configtx'
import { ConfigEnvType } from '../model/type/config.type'
import OrdererDockerComposeYaml from '../model/yaml/docker-compose/ordererDockerComposeYaml'
import PeerDockerComposeYaml from '../model/yaml/docker-compose/peerDockerComposeYaml'
import CaDockerComposeYaml from '../model/yaml/docker-compose/caComposeYaml'
import { OrgJsonType } from '../model/type/org.type'
import { ProcessError } from '../util'
import { Config } from '../config'

export enum InstanceTypeEnum {
  ca = 'ca',
  orderer = 'orderer',
  peer = 'peer'
}

export default class BdkFile {
  private config: Config
  private bdkPath: string
  private envPath: string
  private orgPath: string

  constructor (config: Config, networkName: string = config.networkName) {
    this.config = config
    this.bdkPath = `${config.infraConfig.bdkPath}/${networkName}`
    this.envPath = `${config.infraConfig.bdkPath}/.env`
    this.orgPath = ''
  }

  public getRootFilePath () {
    return this.bdkPath
  }

  public getEnv (): ConfigEnvType {
    if (!fs.existsSync(this.envPath)) throw new ProcessError('Missing process: Run <bdk config init> first')
    return parse(fs.readFileSync(this.envPath).toString()) as unknown as ConfigEnvType
  }

  public createEnv (initEnv: ConfigEnvType) {
    fs.mkdirSync(`${this.config.infraConfig.bdkPath}`, { recursive: true })
    fs.writeFileSync(this.envPath, stringify(initEnv))
  }

  public deleteNetworkFolder () {
    fs.rmdirSync(`${this.bdkPath}`, { recursive: true })
  }

  public createNetworkFolder () {
    fs.mkdirSync(`${this.bdkPath}`, { recursive: true })
  }

  public createCaFolder () {
    fs.mkdirSync(`${this.bdkPath}/ca`, { recursive: true })
  }

  private createConfigYamlFolder () {
    fs.mkdirSync(`${this.bdkPath}/config-yaml`, { recursive: true })
  }

  private createTlsFolder (orgDomainName: string) {
    fs.mkdirSync(`${this.bdkPath}/tlsca/${orgDomainName}`, { recursive: true })
  }

  public createChannelFolder (channelName: string) {
    fs.mkdirSync(`${this.bdkPath}/channel-artifacts/${channelName}`, { recursive: true })
  }

  public createCryptoConfigYaml (cryptoConfigYaml: CryptoConfigYaml) {
    this.createConfigYamlFolder()
    fs.writeFileSync(`${this.bdkPath}/config-yaml/crypto-config.yaml`, cryptoConfigYaml.getYamlString())
  }

  public createConfigtx (configtxYaml: ConfigtxYaml) {
    this.createConfigYamlFolder()
    fs.writeFileSync(`${this.bdkPath}/config-yaml/configtx.yaml`, configtxYaml.getYamlString())
  }

  public createConfigtxOrgs (configtxOrgs: ConfigtxOrgs) {
    this.createConfigYamlFolder()
    fs.writeFileSync(`${this.bdkPath}/config-yaml/configtxOrgs.json`, JSON.stringify(configtxOrgs))
  }

  public getOrdererServerCertToBase64 (hostname: string, domain: string) {
    return fs.readFileSync(`${this.bdkPath}/ordererOrganizations/${domain}/orderers/${hostname}.${domain}/tls/server.crt`).toString('base64')
  }

  public getConfigtxOrgs (): ConfigtxOrgs {
    return JSON.parse(fs.readFileSync(`${this.bdkPath}/config-yaml/configtxOrgs.json`).toString())
  }

  public copyOrdererOrgTLSCa (hostname: string, domain: string) {
    this.createTlsFolder(`${hostname}.${domain}`)
    fs.copyFileSync(`${this.bdkPath}/ordererOrganizations/${domain}/orderers/${hostname}.${domain}/tls/ca.crt`, `${this.bdkPath}/tlsca/${hostname}.${domain}/ca.crt`)
  }

  public copyPeerOrgTLSCa (hostname: string, domain: string) {
    this.createTlsFolder(`${hostname}.${domain}`)
    fs.copyFileSync(`${this.bdkPath}/peerOrganizations/${domain}/peers/${hostname}.${domain}/tls/ca.crt`, `${this.bdkPath}/tlsca/${hostname}.${domain}/ca.crt`)
  }

  public getPeerOrgTlsCertString (number: number, domain: string) {
    // TODO 確認資料夾只有一個檔案
    return fs.readFileSync(`${this.bdkPath}/peerOrganizations/${domain}/peers/peer${number}.${domain}/tls/ca.crt`).toString()
  }

  public getPeerOrgCaCertString (domain: string) {
    return fs.readFileSync(`${this.bdkPath}/peerOrganizations/${domain}/ca/ca.${domain}-cert.pem`).toString()
  }

  public getChannelConfigString (channelName: string, fileName: string) {
    return fs.readFileSync(`${this.bdkPath}/channel-artifacts/${channelName}/${fileName}.json`).toString()
  }

  public getOrgConfigJson (name: string) {
    return fs.readFileSync(`${this.bdkPath}/org-json/${name}.json`).toString()
  }

  public getOrdererOrgConsenter (name: string) {
    return fs.readFileSync(`${this.bdkPath}/org-json/${name}-consenter.json`).toString()
  }

  public createConnectionFile (name: string, domain: string, connectionConfigYaml: ConnectionConfigYaml) {
    fs.writeFileSync(`${this.bdkPath}/peerOrganizations/${domain}/connection-${name}.json`, connectionConfigYaml.getJsonString())
    fs.writeFileSync(`${this.bdkPath}/peerOrganizations/${domain}/connection-${name}.yaml`, connectionConfigYaml.getYamlString())
  }

  public getDockerComposeYamlPath (hostName: string, type: InstanceTypeEnum): string {
    return `${this.bdkPath}/docker-compose/docker-compose-${type}-${hostName}.yaml`
  }

  public getExplorerRootFilePath () {
    return `${this.bdkPath}/fabric-explorer`
  }

  public getExplorerDockerComposeYamlPath (): string {
    return `${this.getExplorerRootFilePath()}/docker-compose.yaml`
  }

  public createDockerComposeYaml (hostName: string, dockerComposeYaml: OrdererDockerComposeYaml | PeerDockerComposeYaml | CaDockerComposeYaml) {
    const type: InstanceTypeEnum = (() => {
      if (dockerComposeYaml instanceof OrdererDockerComposeYaml) {
        return InstanceTypeEnum.orderer
      } else if (dockerComposeYaml instanceof PeerDockerComposeYaml) {
        return InstanceTypeEnum.peer
      } else if (dockerComposeYaml instanceof CaDockerComposeYaml) {
        return InstanceTypeEnum.ca
      }
      return InstanceTypeEnum.orderer
    })()

    fs.mkdirSync(`${this.bdkPath}/docker-compose`, { recursive: true })
    fs.writeFileSync(this.getDockerComposeYamlPath(hostName, type), dockerComposeYaml.getYamlString())
  }

  public getDockerComposeYaml (hostName: string, type: InstanceTypeEnum) {
    return YAML.parse(fs.readFileSync(this.getDockerComposeYamlPath(hostName, type)).toString())
  }

  public createOrgConfigEnv (address: string, dotEnv: string) {
    fs.mkdirSync(`${this.bdkPath}/env`, { recursive: true })
    fs.writeFileSync(`${this.bdkPath}/env/${address}.env`, dotEnv)
  }

  private createChannelConfigtxFolder (channelName: string) {
    fs.mkdirSync(`${this.bdkPath}/config-yaml/${channelName}Channel`, { recursive: true })
  }

  public createChannelConfigtx (channelName: string, configtxYaml: ConfigtxYaml) {
    this.createChannelConfigtxFolder(channelName)
    fs.writeFileSync(`${this.bdkPath}/config-yaml/${channelName}Channel/configtx.yaml`, configtxYaml.getYamlString())
  }

  public createChannelArtifact (channelName: string) {
    fs.mkdirSync(`${this.bdkPath}/channel-artifacts/${channelName}`, { recursive: true })
  }

  public createChaincodeFolder () {
    fs.mkdirSync(`${this.bdkPath}/chaincode`, { recursive: true })
  }

  public createOrgConfigJson (name: string, orgJson: string) {
    fs.mkdirSync(`${this.bdkPath}/org-json`, { recursive: true })
    fs.writeFileSync(`${this.bdkPath}/org-json/${name}.json`, orgJson)
  }

  public createOrdererOrgConsenter (name: string, consenterJson: string) {
    fs.mkdirSync(`${this.bdkPath}/org-json`, { recursive: true })
    fs.writeFileSync(`${this.bdkPath}/org-json/${name}-consenter.json`, consenterJson)
  }

  public createExportOrgConfigJson (exportOrgJson: OrgJsonType, file: string) {
    const splitFilePath = file.split('/', 3)
    for (let i = 0; i < splitFilePath.length - 1; i++) {
      fs.mkdirSync(`${splitFilePath[i]}`, { recursive: true })
    }
    fs.writeFileSync(`${file}`, JSON.stringify(exportOrgJson))
  }

  public createChannelConfigJson (channelName: string, fileName: string, channelConfigJson: string) {
    fs.writeFileSync(`${this.bdkPath}/channel-artifacts/${channelName}/${fileName}.json`, channelConfigJson)
  }

  public getDockerComposeList (): {peer: string[]; orderer: string[]; ca: string[]} {
    const dockerComposeFiles = fs.existsSync(`${this.bdkPath}/docker-compose`) ? fs.readdirSync(`${this.bdkPath}/docker-compose`).map(fileName => fileName.match(/(?<=^docker-compose-).*(?=.yaml$)/)?.[0]).filter(x => x !== undefined) as string[] : []

    return (() => {
      const dccList = { peer: [] as string[], orderer: [] as string[], ca: [] as string[] }

      dockerComposeFiles.forEach(fileName => {
        if (fileName.startsWith('orderer-')) dccList.orderer.push(fileName.slice(8))
        else if (fileName.startsWith('peer-')) dccList.peer.push(fileName.slice(5))
        else if (fileName.startsWith('ca-')) dccList.ca.push(fileName.slice(3))
      })

      return dccList
    })()
  }

  private setOrgPath (orgName: string, type: string) {
    this.orgPath = `${this.bdkPath}/${type}Organizations/${orgName}`
  }

  public caFormatOrg (orgName: string, clientId: string, type: string, hostname: string) {
    this.setOrgPath(hostname, type)

    fs.mkdirSync(`${this.orgPath}/ca`, { recursive: true })
    fs.mkdirSync(`${this.orgPath}/msp/admincerts`, { recursive: true })
    fs.mkdirSync(`${this.orgPath}/msp/tlscacerts`, { recursive: true })
    fs.mkdirSync(`${this.orgPath}/msp/tlsintermediatecerts`, { recursive: true })
    // fs.mkdirSync(`${this.orgPath}/tls`, { recursive: true })

    fs.copySync(
      `${this.bdkPath}/ca/${clientId}@${orgName}/msp`,
      `${this.orgPath}/msp`,
    )
    fs.copyFileSync(
      `${this.orgPath}/msp/cacerts/${this.newestFileInFolder(`${this.orgPath}/msp/cacerts`)}`,
      `${this.orgPath}/msp/tlscacerts/tlsca.${hostname}-cert.pem`,
    )
    fs.copySync(
      `${this.orgPath}/msp/intermediatecerts`,
      `${this.orgPath}/msp/tlsintermediatecerts`,
    )
    fs.copyFileSync(
      `${this.orgPath}/msp/intermediatecerts/${this.newestFileInFolder(`${this.orgPath}/msp/intermediatecerts`)}`,
      `${this.orgPath}/ca/ca.${hostname}-cert.pem`,
    )

    fs.writeFileSync(`${this.orgPath}/msp/config.yaml`, 'NodeOUs:\n  Enable: true\n  ClientOUIdentifier:\n    OrganizationalUnitIdentifier: client\n  PeerOUIdentifier:\n    OrganizationalUnitIdentifier: peer\n  AdminOUIdentifier:\n    OrganizationalUnitIdentifier: admin\n  OrdererOUIdentifier:\n    OrganizationalUnitIdentifier: orderer\n')
  }

  public caFormatOrderer (orgName: string, ordererName: string, hostname: string) {
    this.setOrgPath(hostname, 'orderer')

    fs.mkdirSync(`${this.orgPath}/orderers/${ordererName}/msp/admincerts`, { recursive: true })
    fs.mkdirSync(`${this.orgPath}/orderers/${ordererName}/msp/tlscacerts`, { recursive: true })
    fs.mkdirSync(`${this.orgPath}/orderers/${ordererName}/msp/tlsintermediatecerts`, { recursive: true })

    fs.copySync(
      `${this.bdkPath}/ca/${ordererName}@${orgName}`,
      `${this.orgPath}/orderers/${ordererName}`,
    )
    fs.copySync(
      `${this.orgPath}/orderers/${ordererName}/msp/cacerts`,
     `${this.orgPath}/orderers/${ordererName}/msp/tlscacerts`,
    )
    fs.copySync(
      `${this.orgPath}/orderers/${ordererName}/msp/intermediatecerts`,
      `${this.orgPath}/orderers/${ordererName}/msp/tlsintermediatecerts`,
    )
    // TODO 實驗能否直接做成 cachain ，加上 rca cert    ../tlscacerts/*.pem
    fs.copyFileSync(
      `${this.orgPath}/orderers/${ordererName}/tls/tlsintermediatecerts/${this.newestFileInFolder(`${this.orgPath}/orderers/${ordererName}/tls/tlsintermediatecerts`)}`,
      `${this.orgPath}/orderers/${ordererName}/tls/ca.crt`,
    )
    fs.copyFileSync(
      `${this.orgPath}/orderers/${ordererName}/tls/signcerts/${this.newestFileInFolder(`${this.orgPath}/orderers/${ordererName}/tls/signcerts`)}`,
      `${this.orgPath}/orderers/${ordererName}/tls/server.crt`,
    )
    fs.copyFileSync(
      `${this.orgPath}/orderers/${ordererName}/tls/keystore/${this.newestFileInFolder(`${this.orgPath}/orderers/${ordererName}/tls/keystore`)}`,
      `${this.orgPath}/orderers/${ordererName}/tls/server.key`,
    )

    const userList = fs.existsSync(`${this.orgPath}/users/`) ? fs.readdirSync(`${this.orgPath}/users/`) : []
    userList.forEach((user) => {
      if (user.toLocaleLowerCase().startsWith('admin')) {
        fs.copySync(
        `${this.orgPath}/users/${user}/msp/signcerts/`,
        `${this.orgPath}/orderers/${ordererName}/msp/admincerts`,
        )
      }
    })
  }

  public caFormatPeer (orgName: string, peerName: string, hostname: string) {
    this.setOrgPath(hostname, 'peer')

    fs.mkdirSync(`${this.orgPath}/peers/${peerName}/msp/admincerts`, { recursive: true })
    fs.mkdirSync(`${this.orgPath}/peers/${peerName}/msp/tlscacerts`, { recursive: true })
    fs.mkdirSync(`${this.orgPath}/peers/${peerName}/msp/tlsintermediatecerts`, { recursive: true })

    fs.copySync(
      `${this.bdkPath}/ca/${peerName}@${orgName}`,
      `${this.orgPath}/peers/${peerName}`,
    )
    fs.copyFileSync(
      `${this.orgPath}/peers/${peerName}/msp/cacerts/${this.newestFileInFolder(`${this.orgPath}/peers/${peerName}/msp/cacerts`)}`,
      `${this.orgPath}/peers/${peerName}/msp/tlscacerts/tlsca.${hostname}-cert.pem`)
    fs.copySync(
      `${this.orgPath}/peers/${peerName}/msp/intermediatecerts`,
      `${this.orgPath}/peers/${peerName}/msp/tlsintermediatecerts`,
    )
    // TODO 實驗能否直接做成 cachain ，加上 rca cert    ../tlscacerts/*.pem
    fs.copyFileSync(
      `${this.orgPath}/peers/${peerName}/tls/tlsintermediatecerts/${this.newestFileInFolder(`${this.orgPath}/peers/${peerName}/tls/tlsintermediatecerts`)}`,
      `${this.orgPath}/peers/${peerName}/tls/ca.crt`,
    )
    fs.copyFileSync(
      `${this.orgPath}/peers/${peerName}/tls/signcerts/${this.newestFileInFolder(`${this.orgPath}/peers/${peerName}/tls/signcerts`)}`,
      `${this.orgPath}/peers/${peerName}/tls/server.crt`,
    )
    fs.copyFileSync(
      `${this.orgPath}/peers/${peerName}/tls/keystore/${this.newestFileInFolder(`${this.orgPath}/peers/${peerName}/tls/keystore`)}`,
      `${this.orgPath}/peers/${peerName}/tls/server.key`,
    )

    const userList = fs.existsSync(`${this.orgPath}/users/`) ? fs.readdirSync(`${this.orgPath}/users/`) : []
    userList.forEach((user) => {
      if (user.toLocaleLowerCase().startsWith('admin')) {
        fs.copySync(
        `${this.orgPath}/users/${user}/msp/signcerts/`,
        `${this.orgPath}/peers/${peerName}/msp/admincerts`,
        )
      }
    })
  }

  public caFormatUser (orgName: string, userName: string, type: string, hostname: string) {
    this.setOrgPath(hostname, type)

    fs.mkdirSync(`${this.orgPath}/users/${userName}`, { recursive: true })

    fs.copySync(
      `${this.bdkPath}/ca/${userName}@${orgName}/user`,
      `${this.orgPath}/users/${userName}/msp`,
    )
    fs.copySync(
      `${this.orgPath}/users/${userName}/msp/signcerts/`,
      `${this.orgPath}/msp/admincerts`,
    )
    fs.copySync(
      `${this.orgPath}/users/${userName}/msp/signcerts/`,
      `${this.orgPath}/users/${userName}/msp/admincerts`,
    )

    if (userName.toLocaleLowerCase().startsWith('admin') && fs.existsSync(`${this.orgPath}/${type}s/`)) {
      fs.readdirSync(`${this.orgPath}/${type}s/`).forEach((hostname) => {
        fs.copySync(
        `${this.orgPath}/users/${userName}/msp/signcerts/`,
        `${this.orgPath}/${type}s/${hostname}/msp/admincerts`,
        )
      })
    }
  }

  private newestFileInFolder (folderName: string) {
    const files: string[] = fs.readdirSync(folderName)
    const newest = { fileName: 'stub', created: new Date('December 31, 1999 00:00:00') }
    files.forEach(function (file) {
      const stats = fs.statSync(path.join(folderName, file))
      if (stats.ctime > newest.created) {
        newest.fileName = file
        newest.created = stats.ctime
      }
    })
    return newest.fileName
  }

  private createPackageIdFolder () {
    fs.mkdirSync(`${this.bdkPath}/chaincode/package-id`, { recursive: true })
  }

  public savePackageId (chaincodeLabel: string, packageId: string) {
    this.createPackageIdFolder()
    fs.writeFileSync(`${this.bdkPath}/chaincode/package-id/${chaincodeLabel}`, packageId)
  }

  public getPackageId (chaincodeLabel: string): string {
    if (!fs.existsSync(`${this.bdkPath}/chaincode/package-id/${chaincodeLabel}`)) {
      throw new Error('Should install chaincode or getChaincodePackageId first')
    }
    return fs.readFileSync(`${this.bdkPath}/chaincode/package-id/${chaincodeLabel}`).toString()
  }

  public getDecodedChannelConfig (channelName: string): any {
    return JSON.parse(fs.readFileSync(`${this.bdkPath}/channel-artifacts/${channelName}/${channelName}.json`).toString())
  }
}
